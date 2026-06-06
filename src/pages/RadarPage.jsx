import { useState } from 'react';
import '../styles/radar.css';

const NEARBY_FRIENDS = [
  { id: 1, name: 'Aditya Kumar', username: '@aditya_k', initials: 'AK', distance: '~30m away', online: true, top: '35%', left: '65%' },
  { id: 2, name: 'Sneha Reddy', username: '@sneha.r', initials: 'SR', distance: '~75m away', online: true, top: '25%', left: '35%' },
  { id: 3, name: 'Karan Mehta', username: '@karan_m', initials: 'KM', distance: '~120m away', online: true, top: '70%', left: '28%' },
  { id: 4, name: 'Priya Nair', username: '@priya.n', initials: 'PN', distance: '~150m away', online: false, top: '18%', left: '58%' },
];

export default function RadarPage() {
  const [radarOn, setRadarOn] = useState(false);
  const [range, setRange] = useState(100);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [waved, setWaved] = useState([]);

  const handleWave = (friendId) => {
    if (!waved.includes(friendId)) {
      setWaved(prev => [...prev, friendId]);
    }
  };

  return (
    <div className="radar-page">
      <div className="radar-container">
        <header className="radar-header">
          <h1>📡 Proximity Radar</h1>
          <p>Know when friends are nearby</p>
        </header>

        {/* Toggle */}
        <div className="radar-toggle-section">
          <div className="radar-toggle-wrapper">
            <span className="radar-toggle-label">Radar</span>
            <button
              className={`radar-toggle ${radarOn ? 'active' : ''}`}
              onClick={() => setRadarOn(!radarOn)}
            >
              <span className="radar-toggle-knob" />
            </button>
          </div>
          <p className="radar-privacy-note">
            {radarOn ? 'Your location is shared with nearby friends' : 'Enable to see who\'s around you'}
          </p>
        </div>

        {!radarOn ? (
          /* Off State */
          <div className="radar-off-state">
            <div className="radar-off-icon">📡</div>
            <h3>Radar is off</h3>
            <p>Enable radar to see nearby friends. Your location is only shared approximately.</p>
          </div>
        ) : (
          <>
            {/* Radar Visualization */}
            <div className="radar-visualization">
              <div className="radar-circle-container">
                {/* Rings */}
                <div className="radar-ring radar-ring-1" />
                <div className="radar-ring radar-ring-2" />
                <div className="radar-ring radar-ring-3" />

                {/* Ring Labels */}
                <span className="radar-ring-label radar-ring-label-1">25m</span>
                <span className="radar-ring-label radar-ring-label-2">50m</span>
                <span className="radar-ring-label radar-ring-label-3">100m</span>

                {/* Sweep */}
                <div className="radar-sweep" />

                {/* Pulse ring */}
                <div className="radar-pulse-ring" />

                {/* Center */}
                <div className="radar-center-dot" />
                <span className="radar-center-label">You</span>

                {/* Friend Dots */}
                {NEARBY_FRIENDS.map(f => (
                  <div
                    key={f.id}
                    className="radar-friend-dot"
                    style={{ top: f.top, left: f.left }}
                    title={f.name}
                  />
                ))}
              </div>
            </div>

            {/* Nearby Friends List */}
            <div className="radar-friends-section">
              <h3 className="radar-friends-title">Nearby Friends</h3>
              <div className="radar-friends-list">
                {NEARBY_FRIENDS.map(friend => (
                  <div key={friend.id} className="radar-friend-card">
                    <div className="radar-friend-avatar">
                      {friend.initials}
                      {friend.online && <span className="radar-online-dot" />}
                    </div>
                    <div className="radar-friend-info">
                      <span className="radar-friend-name">{friend.name}</span>
                      <span className="radar-friend-username">{friend.username}</span>
                      <span className="radar-friend-distance">{friend.distance}</span>
                    </div>
                    <button
                      className={`radar-wave-btn ${waved.includes(friend.id) ? 'waved' : ''}`}
                      onClick={() => handleWave(friend.id)}
                    >
                      {waved.includes(friend.id) ? '✓ Waved' : '👋 Wave'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="radar-settings">
              <h3 className="radar-settings-title">Settings</h3>

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
                    onChange={e => setRange(Number(e.target.value))}
                    className="radar-range-slider"
                  />
                </div>
              </div>

              <div className="radar-setting-item">
                <div>
                  <div className="radar-setting-label">Only show to followers</div>
                  <div className="radar-setting-desc">Limit visibility to people who follow you</div>
                </div>
                <button
                  className={`radar-small-toggle ${followersOnly ? 'active' : ''}`}
                  onClick={() => setFollowersOnly(!followersOnly)}
                >
                  <span className="radar-small-toggle-knob" />
                </button>
              </div>

              <div className="radar-setting-item">
                <div>
                  <div className="radar-setting-label">Notifications</div>
                  <div className="radar-setting-desc">Alert when friends are nearby</div>
                </div>
                <button
                  className={`radar-small-toggle ${notifications ? 'active' : ''}`}
                  onClick={() => setNotifications(!notifications)}
                >
                  <span className="radar-small-toggle-knob" />
                </button>
              </div>

              <div className="radar-privacy-text">
                🔒 Your exact location is never shared. Only approximate distance is shown to friends.
                You can disable radar at any time.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
