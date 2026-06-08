import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../utils/socket'
import { usersAPI } from '../utils/api'
import '../styles/app-layout.css'

const sidebarLinks = [
  { to: '/app', icon: '🏠', label: 'Home', end: true },
  { to: '/app/profile', icon: '👤', label: 'Profile' },
  { to: '/app/messages', icon: '💬', label: 'Messages' },
  { to: '/app/notifications', icon: '🔔', label: 'Notifications' },
  { type: 'divider' },
  { to: '/app/anonymous', icon: '🎭', label: 'Anonymous' },
  { to: '/app/voice-rooms', icon: '🎙️', label: 'Voice Rooms' },
  { to: '/app/study-rooms', icon: '📚', label: 'Study Rooms' },
  { type: 'divider' },
  { to: '/app/connect', icon: '🌐', label: 'Connect' },
  { to: '/app/cuffing', icon: '🎉', label: 'Cuffing' },
  { to: '/app/radar', icon: '📡', label: 'Radar' },
]

const mobileTabs = [
  { to: '/app', icon: '🏠', label: 'Home', end: true },
  { to: '/app/messages', icon: '💬', label: 'Messages' },
  { to: '/app/anonymous', icon: '🎭', label: 'Anon' },
  { to: '/app/connect', icon: '🌐', label: 'Connect' },
  { to: '/app/profile', icon: '👤', label: 'Profile' },
]

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function AppLayout() {
  const { currentUser, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeRooms, setActiveRooms] = useState({ voice: false, study: false })
  const dropdownRef = useRef(null)

  // Search states & refs
  const searchRef = useRef(null)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await usersAPI.search(searchQuery.trim())
        setSearchResults(data.users || data || [])
      } catch (err) {
        console.error('Failed to search users:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  // Helper resolving server image URL
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin

  function resolveUrl(url) {
    if (!url) return null
    if (url.startsWith('http')) return url
    return `${API_BASE}${url}`
  }

  // Listen for active room counts
  useEffect(() => {
    const socket = getSocket()
    if (!socket?.connected) return

    const handleVoiceRooms = (data) => {
      setActiveRooms((prev) => ({ ...prev, voice: Array.isArray(data) && data.length > 0 }))
    }
    const handleVideoRooms = (data) => {
      setActiveRooms((prev) => ({ ...prev, study: Array.isArray(data) && data.length > 0 }))
    }

    socket.on('voice:rooms', handleVoiceRooms)
    socket.on('video:rooms', handleVideoRooms)

    // Request initial data
    socket.emit('voice:get-rooms')
    socket.emit('video:get-rooms')

    return () => {
      socket.off('voice:rooms', handleVoiceRooms)
      socket.off('video:rooms', handleVideoRooms)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    setDropdownOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  if (!isAuthenticated) return null

  return (
    <div className="app-layout">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="app-navbar">
        <div className="navbar-left">
          <Link to="/app" className="navbar-logo">
            Town<span>Hall</span>
          </Link>
        </div>

        <div className="navbar-center">
          <div className="navbar-search-wrapper" ref={searchRef}>
            <span className="navbar-search-icon">🔍</span>
            <input
              type="text"
              className="navbar-search"
              placeholder="Search TownHall..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
            />
            {isSearchFocused && searchQuery.trim() && (
              <div className="navbar-search-dropdown">
                {searchLoading ? (
                  <div className="search-dropdown-loading">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="search-dropdown-empty">No users found</div>
                ) : (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="search-dropdown-item"
                      onClick={() => {
                        navigate(`/app/profile/${user.username}`)
                        setSearchQuery('')
                        setIsSearchFocused(false)
                      }}
                    >
                      <div className="search-item-avatar">
                        {user.avatar ? (
                          <img src={resolveUrl(user.avatar)} alt="" />
                        ) : (
                          getInitials(user.fullName)
                        )}
                      </div>
                      <div className="search-item-info">
                        <div className="search-item-name">{user.fullName}</div>
                        <div className="search-item-username">@{user.username}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="navbar-right">
          <button
            className="navbar-icon-btn"
            onClick={() => navigate('/app/notifications')}
            title="Notifications"
          >
            🔔
            <span className="notification-badge" />
          </button>

          <div className="user-dropdown-wrapper" ref={dropdownRef}>
            <button
              className="navbar-avatar"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="Account"
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="" />
              ) : (
                getInitials(currentUser?.fullName)
              )}
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="dropdown-overlay"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="user-dropdown">
                  <div className="dropdown-user-info">
                    <div className="dropdown-user-name">{currentUser?.fullName}</div>
                    <div className="dropdown-user-handle">@{currentUser?.username}</div>
                  </div>
                  <Link
                    to="/app/profile"
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span className="dropdown-item-icon">👤</span>
                    Profile
                  </Link>
                  <button className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <span className="dropdown-item-icon">⚙️</span>
                    Settings
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    <span className="dropdown-item-icon">🚪</span>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className="app-sidebar">
        <Link to="/app/profile" className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" />
            ) : (
              getInitials(currentUser?.fullName)
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{currentUser?.fullName}</div>
            <div className="sidebar-user-handle">@{currentUser?.username}</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {sidebarLinks.map((item, index) => {
            if (item.type === 'divider') {
              return <div key={`div-${index}`} className="sidebar-divider" />
            }
            const hasActivity =
              (item.to === '/app/voice-rooms' && activeRooms.voice) ||
              (item.to === '/app/study-rooms' && activeRooms.study)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <span className="sidebar-link-icon">
                  {item.icon}
                  {hasActivity && <span className="sidebar-active-dot" />}
                </span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="app-content">
        <div className="app-content-feed">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Tab Bar ─────────────────────────────────── */}
      <nav className="mobile-tab-bar">
        {mobileTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `mobile-tab-item${isActive ? ' active' : ''}`
            }
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default AppLayout
