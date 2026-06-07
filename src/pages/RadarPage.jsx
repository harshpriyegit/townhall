import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../utils/socket'
import { useAuth } from '../context/AuthContext'
import '../styles/radar.css'

// Helper: compute position on the radar circle for a user
function computeRadarPosition(distance, range, index, total) {
  // distance → fraction of radius (0 = center, 1 = edge)
  const fraction = Math.min(distance / range, 0.95)
  // spread users evenly by angle, with a golden-ratio offset for visual variety
  const goldenAngle = 137.508
  const angleDeg = (index * goldenAngle) % 360
  const angleRad = (angleDeg * Math.PI) / 180
  // radar container is 340px → radius = 150px usable (inside outermost ring)
  const radiusPx = fraction * 140
  const x = 50 + (radiusPx / 340) * 100 * Math.cos(angleRad)
  const y = 50 + (radiusPx / 340) * 100 * Math.sin(angleRad)
  return { top: `${y}%`, left: `${x}%` }
}

// Helper: format coordinates
function formatCoord(lat, lng) {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`
}

// Helper: time ago
function timeAgo(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

// Distance color class
function distanceClass(distance) {
  if (distance < 50) return 'close'
  if (distance <= 100) return 'medium'
  return 'far'
}

export default function RadarPage() {
  const { currentUser } = useAuth()
  const userId = currentUser?._id || currentUser?.id
  const username = currentUser?.username || currentUser?.fullName || 'User'

  // Core state
  const [radarOn, setRadarOn] = useState(false)
  const [locationState, setLocationState] = useState('idle') // idle | loading | active | error
  const [locationError, setLocationError] = useState(null)
  const [coords, setCoords] = useState(null) // { latitude, longitude, accuracy }
  const [lastUpdate, setLastUpdate] = useState(null)

  // Nearby users
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [alertUserIds, setAlertUserIds] = useState(new Set())
  const [waved, setWaved] = useState(new Set())

  // Wave toasts
  const [waveToasts, setWaveToasts] = useState([])

  // Settings
  const [range, setRange] = useState(100)
  const [followersOnly, setFollowersOnly] = useState(false)
  const [notifications, setNotifications] = useState(true)

  // Refs to avoid stale closures
  const watchIdRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const toastTimeoutRefs = useRef([])
  const socketRef = useRef(null)
  const rangeRef = useRef(range)
  const followersOnlyRef = useRef(followersOnly)

  // Keep refs in sync
  useEffect(() => { rangeRef.current = range }, [range])
  useEffect(() => { followersOnlyRef.current = followersOnly }, [followersOnly])

  // ────────────────────────────────────────────────────
  // Socket listeners setup
  // ────────────────────────────────────────────────────
  useEffect(() => {
    if (!radarOn) return

    const socket = getSocket()
    socketRef.current = socket

    const handleNearbyUsers = (users) => {
      if (Array.isArray(users)) {
        setNearbyUsers(users)
      }
    }

    const handleProximityAlert = (data) => {
      if (!data?.userId) return
      // Flash the dot
      setAlertUserIds(prev => new Set(prev).add(data.userId))
      setTimeout(() => {
        setAlertUserIds(prev => {
          const next = new Set(prev)
          next.delete(data.userId)
          return next
        })
      }, 2500)
    }

    const handleWaveReceived = (data) => {
      if (!data?.fromUsername) return
      const toastId = Date.now() + Math.random()
      setWaveToasts(prev => [...prev, { id: toastId, username: data.fromUsername }])
      // Auto-dismiss after 5s
      const timeout = setTimeout(() => {
        setWaveToasts(prev => prev.map(t =>
          t.id === toastId ? { ...t, exiting: true } : t
        ))
        setTimeout(() => {
          setWaveToasts(prev => prev.filter(t => t.id !== toastId))
        }, 300)
      }, 5000)
      toastTimeoutRefs.current.push(timeout)
    }

    const handleUserOffline = (data) => {
      if (!data?.userId) return
      setNearbyUsers(prev => prev.filter(u => u.userId !== data.userId))
    }

    socket.on('radar:nearby-users', handleNearbyUsers)
    socket.on('radar:proximity-alert', handleProximityAlert)
    socket.on('radar:wave-received', handleWaveReceived)
    socket.on('radar:user-offline', handleUserOffline)

    return () => {
      socket.off('radar:nearby-users', handleNearbyUsers)
      socket.off('radar:proximity-alert', handleProximityAlert)
      socket.off('radar:wave-received', handleWaveReceived)
      socket.off('radar:user-offline', handleUserOffline)
    }
  }, [radarOn])

  // ────────────────────────────────────────────────────
  // Poll for nearby users every 10s
  // ────────────────────────────────────────────────────
  useEffect(() => {
    if (!radarOn || !userId) return

    const socket = getSocket()

    // Immediate first poll
    socket.emit('radar:get-nearby', { userId })

    pollIntervalRef.current = setInterval(() => {
      socket.emit('radar:get-nearby', { userId })
    }, 10000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [radarOn, userId])

  // ────────────────────────────────────────────────────
  // Enable / Disable Radar
  // ────────────────────────────────────────────────────
  const enableRadar = useCallback(() => {
    if (!userId) return

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      setLocationState('error')
      return
    }

    setLocationState('loading')
    setLocationError(null)

    const socket = getSocket()
    socketRef.current = socket

    const onSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords
      setCoords({ latitude, longitude, accuracy })
      setLastUpdate(Date.now())
      setLocationState('active')

      socket.emit('radar:enable', {
        userId,
        username,
        latitude,
        longitude,
        range: rangeRef.current,
        followersOnly: followersOnlyRef.current
      })
    }

    const onUpdate = (position) => {
      const { latitude, longitude, accuracy } = position.coords
      setCoords({ latitude, longitude, accuracy })
      setLastUpdate(Date.now())

      socket.emit('radar:update-location', {
        userId,
        latitude,
        longitude
      })
    }

    const onError = (err) => {
      let msg = 'Unable to get your location.'
      if (err.code === 1) {
        msg = 'Location permission was denied. Please enable it in your browser settings.'
      } else if (err.code === 2) {
        msg = 'Location information is unavailable on this device.'
      } else if (err.code === 3) {
        msg = 'Location request timed out. Please try again.'
      }
      setLocationError(msg)
      setLocationState('error')
      setRadarOn(false)
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    })

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(onUpdate, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    })
  }, [userId, username])

  const disableRadar = useCallback(() => {
    // Clear geolocation watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    // Emit disable
    const socket = getSocket()
    if (userId) {
      socket.emit('radar:disable', { userId })
    }

    // Reset state
    setLocationState('idle')
    setCoords(null)
    setNearbyUsers([])
    setAlertUserIds(new Set())
    setWaved(new Set())
    setWaveToasts([])
  }, [userId])

  // Toggle handler
  const handleToggle = useCallback(() => {
    if (radarOn) {
      setRadarOn(false)
      disableRadar()
    } else {
      setRadarOn(true)
      enableRadar()
    }
  }, [radarOn, enableRadar, disableRadar])

  // ────────────────────────────────────────────────────
  // Settings changes → emit to server
  // ────────────────────────────────────────────────────
  const handleRangeChange = useCallback((e) => {
    const newRange = Number(e.target.value)
    setRange(newRange)
    if (radarOn && userId) {
      const socket = getSocket()
      socket.emit('radar:update-settings', {
        userId,
        range: newRange,
        followersOnly: followersOnlyRef.current
      })
    }
  }, [radarOn, userId])

  const handleFollowersToggle = useCallback(() => {
    setFollowersOnly(prev => {
      const next = !prev
      if (radarOn && userId) {
        const socket = getSocket()
        socket.emit('radar:update-settings', {
          userId,
          range: rangeRef.current,
          followersOnly: next
        })
      }
      return next
    })
  }, [radarOn, userId])

  // ────────────────────────────────────────────────────
  // Wave handler
  // ────────────────────────────────────────────────────
  const handleWave = useCallback((toUserId) => {
    if (waved.has(toUserId) || !userId) return
    const socket = getSocket()
    socket.emit('radar:wave', {
      fromUserId: userId,
      fromUsername: username,
      toUserId
    })
    setWaved(prev => new Set(prev).add(toUserId))
  }, [userId, username, waved])

  // ────────────────────────────────────────────────────
  // Cleanup on unmount
  // ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Clear geolocation watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      // Clear polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      // Clear toast timeouts
      toastTimeoutRefs.current.forEach(clearTimeout)
      // Emit disable
      try {
        const socket = getSocket()
        if (userId) {
          socket.emit('radar:disable', { userId })
        }
        socket.off('radar:nearby-users')
        socket.off('radar:proximity-alert')
        socket.off('radar:wave-received')
        socket.off('radar:user-offline')
      } catch (e) {
        // socket may not exist
      }
    }
  }, [userId])

  // ────────────────────────────────────────────────────
  // Tick: update "Updated Xs ago" display
  // ────────────────────────────────────────────────────
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!radarOn || !lastUpdate) return
    const interval = setInterval(() => forceUpdate(n => n + 1), 3000)
    return () => clearInterval(interval)
  }, [radarOn, lastUpdate])

  // ────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────
  return (
    <div className="radar-page">
      <div className="radar-container">

        {/* Header */}
        <header className="radar-header">
          <h1>📡 Proximity Radar</h1>
          <p>Know when friends are nearby</p>
        </header>

        {/* Toggle Section */}
        <div className="radar-toggle-section">
          <div className="radar-toggle-wrapper">
            <span className="radar-toggle-label">Radar</span>
            <button
              className={`radar-toggle ${radarOn ? 'active' : ''}`}
              onClick={handleToggle}
              aria-label="Toggle radar"
            >
              <span className="radar-toggle-knob" />
            </button>
          </div>
          <p className="radar-privacy-note">
            {radarOn
              ? 'Your approximate location is shared with nearby friends'
              : 'Enable to see who\'s around you'
            }
          </p>
        </div>

        {/* Wave Toast Notifications */}
        {waveToasts.length > 0 && (
          <div className="radar-wave-toasts">
            {waveToasts.map(toast => (
              <div
                key={toast.id}
                className={`radar-wave-toast ${toast.exiting ? 'exiting' : ''}`}
              >
                <span className="radar-wave-toast-emoji">👋</span>
                <span className="radar-wave-toast-text">
                  <span>{toast.username}</span> waved at you!
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Radar OFF state ──────────────────────── */}
        {!radarOn && locationState !== 'error' && (
          <div className="radar-off-state">
            <div className="radar-off-icon">📡</div>
            <h3>Radar is off</h3>
            <p>
              Enable radar to discover friends nearby. Your exact location is never
              shared — only approximate distance is shown.
            </p>
            <div className="radar-off-features">
              <div className="radar-off-feature">🔒 Privacy first</div>
              <div className="radar-off-feature">📍 Real-time distance</div>
              <div className="radar-off-feature">👋 Wave at friends</div>
            </div>
          </div>
        )}

        {/* ── Location Error state ─────────────────── */}
        {locationState === 'error' && (
          <div className="radar-error">
            <div className="radar-error-icon">📍</div>
            <h3>Location unavailable</h3>
            <p>{locationError}</p>
            <button className="radar-retry-btn" onClick={() => { setRadarOn(true); enableRadar() }}>
              ↻ Try again
            </button>
          </div>
        )}

        {/* ── Loading state ────────────────────────── */}
        {radarOn && locationState === 'loading' && (
          <div className="radar-loading">
            <div className="radar-loading-spinner" />
            <p>Getting your location…</p>
          </div>
        )}

        {/* ── Radar ACTIVE state ───────────────────── */}
        {radarOn && locationState === 'active' && (
          <>
            {/* Location Status Bar */}
            {coords && (
              <div className="radar-location-status">
                <div className="radar-status-item">
                  <span className="radar-status-dot" />
                  <span>Live</span>
                </div>
                <div className="radar-status-item">
                  📍 {formatCoord(coords.latitude, coords.longitude)}
                </div>
                {coords.accuracy && (
                  <div className="radar-status-item">
                    ± {Math.round(coords.accuracy)}m accuracy
                  </div>
                )}
                {lastUpdate && (
                  <div className="radar-status-item">
                    Updated {timeAgo(lastUpdate)}
                  </div>
                )}
              </div>
            )}

            {/* Radar Visualization */}
            <div className="radar-visualization">
              <div className="radar-circle-container">
                {/* Crosshairs */}
                <div className="radar-crosshair-h" />
                <div className="radar-crosshair-v" />

                {/* Concentric Rings */}
                <div className="radar-ring radar-ring-1" />
                <div className="radar-ring radar-ring-2" />
                <div className="radar-ring radar-ring-3" />

                {/* Ring Labels */}
                <span className="radar-ring-label radar-ring-label-1">
                  {Math.round(range * 0.25)}m
                </span>
                <span className="radar-ring-label radar-ring-label-2">
                  {Math.round(range * 0.5)}m
                </span>
                <span className="radar-ring-label radar-ring-label-3">
                  {range}m
                </span>

                {/* Rotating Sweep */}
                <div className="radar-sweep" />

                {/* Pulse Rings */}
                <div className="radar-pulse-ring" />
                <div className="radar-pulse-ring-2" />

                {/* Center Dot */}
                <div className="radar-center-dot" />
                <span className="radar-center-label">You</span>

                {/* Nearby User Dots */}
                {nearbyUsers.map((user, idx) => {
                  const pos = computeRadarPosition(
                    user.distance || 0,
                    range,
                    idx,
                    nearbyUsers.length
                  )
                  const isAlert = alertUserIds.has(user.userId)
                  return (
                    <div
                      key={user.userId}
                      className={`radar-user-dot ${isAlert ? 'alert' : ''}`}
                      style={{ top: pos.top, left: pos.left }}
                    >
                      <div className="radar-user-dot-inner" />
                      <div className="radar-user-tooltip">
                        {user.username} · ~{Math.round(user.distance)}m
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nearby Friends List */}
            <div className="radar-friends-section">
              <div className="radar-friends-header">
                <h3 className="radar-friends-title">Nearby Friends</h3>
                {nearbyUsers.length > 0 && (
                  <span className="radar-friends-count">
                    {nearbyUsers.length} found
                  </span>
                )}
              </div>

              {nearbyUsers.length === 0 ? (
                <div className="radar-empty-state">
                  <div className="radar-empty-icon">👀</div>
                  <h4>No friends nearby right now</h4>
                  <p>When friends enable their radar, they'll appear here.</p>
                </div>
              ) : (
                <div className="radar-friends-list">
                  {nearbyUsers.map(user => {
                    const initial = (user.username || '?')[0].toUpperCase()
                    const dist = Math.round(user.distance || 0)
                    const dClass = distanceClass(dist)
                    const hasWaved = waved.has(user.userId)
                    return (
                      <div key={user.userId} className="radar-friend-card">
                        <div className="radar-friend-avatar">
                          {initial}
                          <span className="radar-online-dot" />
                        </div>
                        <div className="radar-friend-info">
                          <span className="radar-friend-name">
                            {user.username}
                          </span>
                          <span className={`radar-friend-distance ${dClass}`}>
                            ~{dist}m away
                          </span>
                        </div>
                        <button
                          className={`radar-wave-btn ${hasWaved ? 'waved' : ''}`}
                          onClick={() => handleWave(user.userId)}
                          disabled={hasWaved}
                        >
                          {hasWaved ? '✓ Waved' : '👋 Wave'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="radar-settings">
              <h3 className="radar-settings-title">Settings</h3>

              {/* Range */}
              <div className="radar-setting-item">
                <div>
                  <div className="radar-setting-label">Range</div>
                  <div className="radar-setting-desc">How far to scan for friends</div>
                </div>
                <div className="radar-range-wrapper">
                  <span className="radar-range-value">{range}m</span>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={range}
                    onChange={handleRangeChange}
                    className="radar-range-slider"
                  />
                </div>
              </div>

              {/* Followers only */}
              <div className="radar-setting-item">
                <div>
                  <div className="radar-setting-label">Only show to followers</div>
                  <div className="radar-setting-desc">Limit visibility to people who follow you</div>
                </div>
                <button
                  className={`radar-small-toggle ${followersOnly ? 'active' : ''}`}
                  onClick={handleFollowersToggle}
                  aria-label="Toggle followers only"
                >
                  <span className="radar-small-toggle-knob" />
                </button>
              </div>

              {/* Notifications */}
              <div className="radar-setting-item">
                <div>
                  <div className="radar-setting-label">Notifications</div>
                  <div className="radar-setting-desc">Alert when friends are nearby</div>
                </div>
                <button
                  className={`radar-small-toggle ${notifications ? 'active' : ''}`}
                  onClick={() => setNotifications(prev => !prev)}
                  aria-label="Toggle notifications"
                >
                  <span className="radar-small-toggle-knob" />
                </button>
              </div>

              <div className="radar-privacy-text">
                <span className="lock-icon">🔒</span>
                <span>
                  Your exact location is never shared. Only approximate distance
                  is shown to other users. You can disable radar at any time.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
