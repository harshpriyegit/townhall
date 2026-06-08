import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { datingAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import '../styles/connect.css';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin;

function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const PROFILES = [
  { id: 'mock-1', name: 'Priya', age: 20, branch: 'CSE', bio: 'Coffee addict ☕ | Love hiking and coding marathons', interests: ['Music', 'Travel', 'Coding', 'Coffee'], initials: 'PR' },
  { id: 'mock-2', name: 'Arjun', age: 21, branch: 'ECE', bio: 'Music is my therapy 🎸 | Sports enthusiast', interests: ['Music', 'Sports', 'Gaming', 'Travel'], initials: 'AR' },
  { id: 'mock-3', name: 'Sneha', age: 19, branch: 'IT', bio: 'Bookworm 📖 | Aspiring data scientist', interests: ['Books', 'Data Science', 'Art', 'Cooking'], initials: 'SN' },
  { id: 'mock-4', name: 'Rahul', age: 22, branch: 'MECH', bio: 'Car enthusiast 🚗 | Gym rat', interests: ['Cars', 'Fitness', 'Photography', 'Tech'], initials: 'RA' },
  { id: 'mock-5', name: 'Ananya', age: 20, branch: 'BioTech', bio: 'Dance 💃 | Foodie | Always exploring', interests: ['Dance', 'Food', 'Travel', 'Movies'], initials: 'AN' },
  { id: 'mock-6', name: 'Ishaan', age: 21, branch: 'Civil', bio: 'Always seeking adrenaline adventures 🏂', interests: ['Outdoors', 'Sports', 'Travel'], initials: 'IS' },
  { id: 'mock-7', name: 'Kavya', age: 20, branch: 'Chem', bio: 'Film photography lover 📷 and record collector', interests: ['Art', 'Music', 'Photography'], initials: 'KV' },
];

const MATCHES = [
  { id: 'm-1', name: 'Isha', initials: 'IS' },
  { id: 'm-2', name: 'Dev', initials: 'DV' },
  { id: 'm-3', name: 'Riya', initials: 'RI' },
];

export default function ConnectPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [discoverProfiles, setDiscoverProfiles] = useState([]);
  const [connections, setConnections] = useState([]);
  
  // Globe rotation states
  const [isRotating, setIsRotating] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [connectionSuccess, setConnectionSuccess] = useState(null); // null | { isMatch: boolean }
  const [submittingConnect, setSubmittingConnect] = useState(false);

  // Modal & Form state
  const [isEditing, setIsEditing] = useState(false);
  const [formAge, setFormAge] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formInterests, setFormInterests] = useState('');
  const [formLookingFor, setFormLookingFor] = useState('');

  const fetchDiscovery = async () => {
    try {
      const data = await datingAPI.discover();
      if (data.profiles && data.profiles.length > 0) {
        const mapped = data.profiles.map(p => ({
          id: p.id,
          userId: p.userId,
          name: p.user?.fullName || 'User',
          age: p.age || 20,
          branch: p.branch || 'VIT',
          bio: p.bio || '',
          interests: p.interests || [],
          initials: getInitials(p.user?.fullName),
          avatar: p.user?.avatar || null,
        }));
        setDiscoverProfiles(mapped);
      } else {
        setDiscoverProfiles(PROFILES);
      }
    } catch (err) {
      console.warn('Failed to fetch discover profiles, using local mock:', err.message);
      setDiscoverProfiles(PROFILES);
    }
  };

  const fetchConnections = async () => {
    try {
      const data = await datingAPI.getMatches();
      if (data.matches && data.matches.length > 0) {
        const mapped = data.matches.map(m => ({
          id: m.id,
          name: m.fullName || 'User',
          initials: getInitials(m.fullName),
          avatar: m.avatar || null
        }));
        setConnections(mapped);
      } else {
        setConnections(MATCHES);
      }
    } catch (err) {
      console.warn('Failed to fetch matches, using local mock:', err.message);
      setConnections(MATCHES);
    }
  };

  // Check profile status on mount
  useEffect(() => {
    let cancelled = false;

    async function checkDatingProfile() {
      try {
        const data = await datingAPI.getProfile();
        if (cancelled) return;

        if (data.profile) {
          setProfileData(data.profile);
          setHasProfile(true);
          
          setFormAge(data.profile.age || '');
          setFormBranch(data.profile.branch || '');
          setFormBio(data.profile.bio || '');
          setFormInterests(data.profile.interests?.join(', ') || '');
          setFormLookingFor(data.profile.lookingFor || '');
        } else {
          setHasProfile(false);
        }
      } catch (err) {
        console.warn('Failed to check dating profile status:', err.message);
        setHasProfile(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkDatingProfile();
    return () => { cancelled = true; };
  }, []);

  // Fetch lists after loading finishes
  useEffect(() => {
    if (!loading) {
      fetchDiscovery();
      fetchConnections();
    }
  }, [loading]);

  // Handle globe rotation
  const handleRotateGlobe = () => {
    if (isRotating) return;
    setIsRotating(true);
    setSelectedUser(null);
    setConnectionSuccess(null);

    // After 1.2s spin animation finishes
    setTimeout(() => {
      setIsRotating(false);
      // Advance to next batch of 4 profiles
      setBatchIndex(prev => {
        const next = prev + 4;
        return next >= discoverProfiles.length ? 0 : next;
      });
    }, 1200);
  };

  // Action to connect with selected user
  const handleConnectRequest = async () => {
    if (!selectedUser || submittingConnect) return;
    setSubmittingConnect(true);
    try {
      const isMock = selectedUser.id.startsWith('mock-');
      if (isMock) {
        // Mock connection behavior
        setTimeout(() => {
          const randMatch = Math.random() > 0.4; // 60% chance to match
          setConnectionSuccess({ isMatch: randMatch });
          setSubmittingConnect(false);
          if (randMatch) {
            setConnections(prev => [
              {
                id: selectedUser.id,
                name: selectedUser.name,
                initials: selectedUser.initials,
                avatar: selectedUser.avatar
              },
              ...prev
            ]);
          }
        }, 1000);
      } else {
        // Real API connection
        const result = await datingAPI.swipe(selectedUser.userId || selectedUser.id, 'like');
        setConnectionSuccess({ isMatch: result.isMatch });
        setSubmittingConnect(false);
        if (result.isMatch) {
          fetchConnections();
        }
      }
    } catch (err) {
      console.error('Failed to send connect swipe:', err);
      setSubmittingConnect(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const interestsArray = formInterests
        .split(',')
        .map(i => i.trim())
        .filter(Boolean);

      const result = await datingAPI.updateProfile({
        age: parseInt(formAge) || null,
        branch: formBranch,
        bio: formBio,
        interests: interestsArray,
        lookingFor: formLookingFor
      });

      const updated = result.profile || result;
      setProfileData(updated);
      setHasProfile(true);
      setIsEditing(false);
      
      fetchDiscovery();
    } catch (err) {
      console.error('Failed to save connect profile:', err);
    }
  };

  // Get current batch of 4 profiles to render on the globe
  const currentBatch = discoverProfiles.slice(batchIndex, batchIndex + 4);

  return (
    <div className="connect-page">
      <div className="connect-container">
        <header className="connect-header">
          <h1>🌐 Connect</h1>
          <p>Rotate the globe to discover and connect with VIT students</p>
        </header>

        <div className="connect-layout">
          {/* Globe & Interactive Area */}
          <main className="connect-globe-area">
            {!hasProfile ? (
              <div className="connect-profile-prompt">
                <div className="connect-prompt-icon">🌐</div>
                <h3>Connect is locked</h3>
                <p>Set up your profile domain to unlock the globe and match with other students!</p>
                <button className="connect-setup-action-btn" onClick={() => setIsEditing(true)}>
                  Set Up Connect Profile
                </button>
              </div>
            ) : (
              <div className="globe-interactive-card">
                {/* Globe Hologram Sphere */}
                <div className="globe-outer-wrapper">
                  <div className={`globe-sphere ${isRotating ? 'spinning' : ''}`}>
                    {/* Concentric high-tech grid rings */}
                    <div className="globe-ring lat-1" />
                    <div className="globe-ring lat-2" />
                    <div className="globe-ring lon-1" />
                    <div className="globe-ring lon-2" />

                    {/* Orbiting Profile Nodes */}
                    {!isRotating && currentBatch.map((profile, idx) => (
                      <div
                        key={profile.id}
                        className={`globe-profile-node node-pos-${idx} ${selectedUser?.id === profile.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedUser(profile);
                          setConnectionSuccess(null);
                        }}
                      >
                        <div className="node-avatar">
                          {profile.avatar ? (
                            <img src={resolveUrl(profile.avatar)} alt="" />
                          ) : (
                            profile.initials
                          )}
                        </div>
                        <span className="node-pulse" />
                        <span className="node-tooltip">{profile.name}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Glowing background radar */}
                  <div className="globe-glow-backdrop" />
                </div>

                <div className="globe-control-actions">
                  <button
                    className={`globe-spin-btn ${isRotating ? 'spinning' : ''}`}
                    onClick={handleRotateGlobe}
                    disabled={isRotating}
                  >
                    🔄 Rotate Globe
                  </button>
                </div>

                {/* Connect Details Panel (shown when a node is clicked) */}
                {selectedUser && !isRotating && (
                  <div className="connect-user-popup animate-popup">
                    <div className="popup-header">
                      <div className="popup-avatar">
                        {selectedUser.avatar ? (
                          <img src={resolveUrl(selectedUser.avatar)} alt="" />
                        ) : (
                          selectedUser.initials
                        )}
                      </div>
                      <div className="popup-meta">
                        <h4>{selectedUser.name}, {selectedUser.age}</h4>
                        <span>{selectedUser.branch}</span>
                      </div>
                      <button className="popup-close" onClick={() => setSelectedUser(null)}>✕</button>
                    </div>

                    <p className="popup-bio">{selectedUser.bio || 'No bio provided.'}</p>
                    <div className="popup-tags">
                      {selectedUser.interests?.map(i => (
                        <span key={i} className="popup-tag">{i}</span>
                      ))}
                    </div>

                    {/* Connection Result / Call to Action */}
                    <div className="popup-connect-action">
                      {connectionSuccess === null ? (
                        <button
                          className="popup-connect-btn"
                          onClick={handleConnectRequest}
                          disabled={submittingConnect}
                        >
                          {submittingConnect ? 'Connecting...' : '🤝 Connect'}
                        </button>
                      ) : connectionSuccess.isMatch ? (
                        <div className="connect-alert match">
                          <span>🎉 Connected! You matched with {selectedUser.name}!</span>
                          <button
                            className="connect-chat-btn"
                            onClick={() => navigate('/app/messages')}
                          >
                            💬 Chat Now
                          </button>
                        </div>
                      ) : (
                        <div className="connect-alert pending">
                          <span>📡 Connection request sent! They will see it in notifications.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Sidebar Info */}
          <aside className="connect-sidebar">
            {/* Connections Scroll */}
            <div className="connect-sidebar-card">
              <h3 className="sidebar-card-title">Your Connections</h3>
              <p className="sidebar-card-subtitle">{connections.length} active connections</p>
              <div className="sidebar-connections-scroll">
                {connections.length === 0 ? (
                  <div className="sidebar-empty">No connections yet</div>
                ) : (
                  connections.map((c, i) => (
                    <div
                      key={i}
                      className="sidebar-connection-item"
                      onClick={() => navigate('/app/messages')}
                      title={`Chat with ${c.name}`}
                    >
                      <div className="connection-avatar">
                        {c.avatar ? (
                          <img src={resolveUrl(c.avatar)} alt="" />
                        ) : (
                          c.initials
                        )}
                      </div>
                      <span className="connection-name">{c.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Profile Setup */}
            <div className="connect-sidebar-card">
              <h3 className="sidebar-card-title">Your Connect Profile</h3>
              {hasProfile ? (
                <div className="sidebar-profile-details">
                  <div className="profile-detail-row">
                    <span>Age</span>
                    <span>{profileData?.age}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span>Branch</span>
                    <span>{profileData?.branch}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span>Looking For</span>
                    <span>{profileData?.lookingFor || 'Not specified'}</span>
                  </div>
                  <div className="profile-bio-section">
                    <span>BIO</span>
                    <p>{profileData?.bio}</p>
                  </div>
                  <div className="profile-interests-section">
                    <span>INTERESTS</span>
                    <div className="popup-tags">
                      {profileData?.interests?.map(i => (
                        <span key={i} className="popup-tag">{i}</span>
                      ))}
                    </div>
                  </div>
                  <button className="sidebar-edit-profile-btn" onClick={() => setIsEditing(true)}>
                    ✍️ Edit Profile
                  </button>
                </div>
              ) : (
                <div className="sidebar-profile-empty">
                  <p>Configure your profile details to show on the globe!</p>
                  <button className="sidebar-edit-profile-btn" onClick={() => setIsEditing(true)}>
                    🌐 Setup Profile
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Form Modal ───────────────────────────────── */}
      {isEditing && (
        <div className="connect-modal-backdrop">
          <div className="connect-modal">
            <div className="connect-modal-header">
              <h2>{hasProfile ? 'Edit Connect Profile' : 'Set Up Connect Profile'}</h2>
              <button className="connect-modal-close" onClick={() => setIsEditing(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className="connect-modal-form">
              <div className="connect-form-group">
                <label>Age</label>
                <input
                  type="number"
                  min="16"
                  max="35"
                  required
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="connect-form-group">
                <label>Branch / Major</label>
                <input
                  type="text"
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  placeholder="e.g. CSE"
                />
              </div>

              <div className="connect-form-group">
                <label>Bio</label>
                <textarea
                  required
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Introduce yourself to the community..."
                  maxLength="250"
                  rows="3"
                />
              </div>

              <div className="connect-form-group">
                <label>Interests (comma separated)</label>
                <input
                  type="text"
                  value={formInterests}
                  onChange={(e) => setFormInterests(e.target.value)}
                  placeholder="e.g. Music, Coding, Sports"
                />
              </div>

              <div className="connect-form-group">
                <label>What are you looking for?</label>
                <input
                  type="text"
                  value={formLookingFor}
                  onChange={(e) => setFormLookingFor(e.target.value)}
                  placeholder="e.g. Friends, Collaboration, Study partner"
                />
              </div>

              <div className="connect-modal-actions">
                <button type="button" className="connect-btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="connect-btn-submit">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
