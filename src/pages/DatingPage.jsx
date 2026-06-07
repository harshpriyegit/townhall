import { useState, useEffect } from 'react';
import { datingAPI } from '../utils/api';
import '../styles/dating.css';

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
  { id: 1, name: 'Priya', age: 20, branch: 'CSE', bio: 'Coffee addict ☕ | Love hiking and coding marathons', interests: ['Music', 'Travel', 'Coding', 'Coffee'], initials: 'PR', gradient: 'g1' },
  { id: 2, name: 'Arjun', age: 21, branch: 'ECE', bio: 'Music is my therapy 🎸 | Sports enthusiast', interests: ['Music', 'Sports', 'Gaming', 'Travel'], initials: 'AR', gradient: 'g2' },
  { id: 3, name: 'Sneha', age: 19, branch: 'IT', bio: 'Bookworm 📖 | Aspiring data scientist', interests: ['Books', 'Data Science', 'Art', 'Cooking'], initials: 'SN', gradient: 'g3' },
  { id: 4, name: 'Rahul', age: 22, branch: 'MECH', bio: 'Car enthusiast 🚗 | Gym rat', interests: ['Cars', 'Fitness', 'Photography', 'Tech'], initials: 'RA', gradient: 'g4' },
  { id: 5, name: 'Ananya', age: 20, branch: 'BioTech', bio: 'Dance 💃 | Foodie | Always exploring', interests: ['Dance', 'Food', 'Travel', 'Movies'], initials: 'AN', gradient: 'g5' },
];

const MATCHES = [
  { name: 'Isha', initials: 'IS' },
  { name: 'Dev', initials: 'DV' },
  { name: 'Riya', initials: 'RI' },
  { name: 'Karan', initials: 'KR' },
];

export default function DatingPage() {
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [discoverProfiles, setDiscoverProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null);
  
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
          gradient: `g${(Math.floor(Math.random() * 5) + 1)}`
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

  const fetchMatches = async () => {
    try {
      const data = await datingAPI.getMatches();
      if (data.matches && data.matches.length > 0) {
        const mapped = data.matches.map(m => ({
          name: m.fullName || 'User',
          initials: getInitials(m.fullName),
          avatar: m.avatar || null
        }));
        setMatches(mapped);
      } else {
        setMatches(MATCHES);
      }
    } catch (err) {
      console.warn('Failed to fetch matches, using local mock:', err.message);
      setMatches(MATCHES);
    }
  };

  // Check dating profile status on mount
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

  // Fetch discover and matches after loading finishes
  useEffect(() => {
    if (!loading) {
      fetchDiscovery();
      fetchMatches();
    }
  }, [loading]);

  const handleAction = async (direction) => {
    if (currentIndex >= discoverProfiles.length) return;
    const profile = discoverProfiles[currentIndex];
    
    setSwipeDir(direction);
    
    const action = direction === 'right' ? 'like' : 'pass';
    try {
      if (profile.userId || typeof profile.id === 'string') {
        const result = await datingAPI.swipe(profile.userId || profile.id, action);
        if (result.isMatch) {
          alert(`It's a Match! 🎉 You matched with ${profile.name}!`);
          fetchMatches();
        }
      }
    } catch (err) {
      console.warn('Swipe API failed:', err.message);
    }

    setTimeout(() => {
      setSwipeDir(null);
      setCurrentIndex(prev => prev + 1);
    }, 450);
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
      
      // Refresh discover feed
      fetchDiscovery();
    } catch (err) {
      console.error('Failed to save dating profile:', err);
    }
  };

  const currentProfile = discoverProfiles[currentIndex];
  const nextProfile = discoverProfiles[currentIndex + 1];
  const thirdProfile = discoverProfiles[currentIndex + 2];

  return (
    <div className="dating-page">
      <div className="dating-container">
        <header className="dating-header">
          <h1>❤️ Dating</h1>
          <p>Find your match at VIT</p>
        </header>

        <div className="dating-layout">
          <main className="dating-card-area">
            {!hasProfile ? (
              <div className="dating-profile-prompt">
                <div className="dating-prompt-icon">❤️</div>
                <h3>Dating is locked</h3>
                <p>Set up your dating profile to start seeing others and finding matches at VIT!</p>
                <button className="dating-setup-action-btn" onClick={() => setIsEditing(true)}>
                  Set Up Profile
                </button>
              </div>
            ) : (
              <>
                <div className="dating-card-wrapper">
                  {/* Stack behind */}
                  {thirdProfile && (
                    <div className="dating-card dating-card-stack-2">
                      <div className="dating-card-bg">
                        {thirdProfile.avatar ? (
                          <img src={resolveUrl(thirdProfile.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <>
                            <div className={`dating-card-gradient ${thirdProfile.gradient}`} />
                            <div className="dating-card-initials">{thirdProfile.initials}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {nextProfile && (
                    <div className="dating-card dating-card-stack-1">
                      <div className="dating-card-bg">
                        {nextProfile.avatar ? (
                          <img src={resolveUrl(nextProfile.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <>
                            <div className={`dating-card-gradient ${nextProfile.gradient}`} />
                            <div className="dating-card-initials">{nextProfile.initials}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Active card */}
                  {currentProfile ? (
                    <div
                      className={`dating-card dating-card-active ${
                        swipeDir === 'left' ? 'swiping-left' : swipeDir === 'right' ? 'swiping-right' : ''
                      }`}
                    >
                      <div className="dating-card-bg">
                        {currentProfile.avatar ? (
                          <img src={resolveUrl(currentProfile.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <>
                            <div className={`dating-card-gradient ${currentProfile.gradient}`} />
                            <div className="dating-card-initials">{currentProfile.initials}</div>
                          </>
                        )}
                      </div>
                      <div className="dating-card-info">
                        <span className="dating-card-name">
                          {currentProfile.name}, {currentProfile.age}
                        </span>
                        <span className="dating-card-branch">{currentProfile.branch}</span>
                        <p className="dating-card-bio">{currentProfile.bio}</p>
                        <div className="dating-card-tags">
                          {currentProfile.interests.map(tag => (
                            <span key={tag} className="dating-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="dating-empty">
                      <div className="dating-empty-icon">✨</div>
                      <h3>No more profiles</h3>
                      <p>Check back later for new people</p>
                    </div>
                  )}
                </div>

                {currentProfile && (
                  <div className="dating-actions">
                    <button className="dating-action-btn pass" onClick={() => handleAction('left')}>
                      ❌
                    </button>
                    <button className="dating-action-btn super" onClick={() => handleAction('right')}>
                      ⭐
                    </button>
                    <button className="dating-action-btn like" onClick={() => handleAction('right')}>
                      ❤️
                    </button>
                  </div>
                )}
              </>
            )}
          </main>

          <aside className="dating-sidebar">
            <div className="dating-matches-card">
              <h3 className="dating-matches-title">Your Matches</h3>
              <p className="dating-matches-count">{matches.length} matches</p>
              <div className="dating-matches-scroll">
                {matches.map((m, i) => (
                  <div key={i} className="dating-match-item">
                    <div className="dating-match-avatar">
                      {m.avatar ? (
                        <img src={resolveUrl(m.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        m.initials
                      )}
                    </div>
                    <span className="dating-match-name">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dating-setup-card">
              <h3 className="dating-setup-title">Your Dating Profile</h3>
              {hasProfile ? (
                <div className="dating-profile-details">
                  <div className="dating-profile-detail-row">
                    <span>Age</span>
                    <span>{profileData?.age}</span>
                  </div>
                  <div className="dating-profile-detail-row">
                    <span>Branch</span>
                    <span>{profileData?.branch}</span>
                  </div>
                  <div className="dating-profile-detail-row">
                    <span>Looking For</span>
                    <span>{profileData?.lookingFor || 'Not specified'}</span>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>BIO</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                      {profileData?.bio}
                    </p>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>INTERESTS</span>
                    <div className="dating-card-tags" style={{ marginTop: '4px' }}>
                      {profileData?.interests?.map(i => (
                        <span key={i} className="dating-tag">{i}</span>
                      ))}
                    </div>
                  </div>
                  <button className="dating-setup-profile-btn" onClick={() => setIsEditing(true)}>
                    ✍️ Edit Profile
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Create your profile to start meeting other students at VIT.
                  </p>
                  <button className="dating-setup-profile-btn" onClick={() => setIsEditing(true)}>
                    ❤️ Set Up Profile
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Profile Edit/Create Modal ──────────────────── */}
      {isEditing && (
        <div className="dating-modal-backdrop">
          <div className="dating-modal">
            <div className="dating-modal-header">
              <h2>{hasProfile ? 'Edit Dating Profile' : 'Set Up Dating Profile'}</h2>
              <button className="dating-modal-close" onClick={() => setIsEditing(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className="dating-modal-form">
              <div className="dating-form-group">
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

              <div className="dating-form-group">
                <label>Branch / Major</label>
                <input
                  type="text"
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  placeholder="e.g. CSE"
                />
              </div>

              <div className="dating-form-group">
                <label>Bio</label>
                <textarea
                  required
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Tell others about yourself..."
                  maxLength="250"
                  rows="3"
                />
              </div>

              <div className="dating-form-group">
                <label>Interests (comma separated)</label>
                <input
                  type="text"
                  value={formInterests}
                  onChange={(e) => setFormInterests(e.target.value)}
                  placeholder="e.g. Music, Coding, Travel"
                />
              </div>

              <div className="dating-form-group">
                <label>What are you looking for?</label>
                <input
                  type="text"
                  value={formLookingFor}
                  onChange={(e) => setFormLookingFor(e.target.value)}
                  placeholder="e.g. Friends, Relationship"
                />
              </div>

              <div className="dating-modal-actions">
                <button type="button" className="dating-btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="dating-btn-submit">
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
