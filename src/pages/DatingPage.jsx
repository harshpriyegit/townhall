import { useState } from 'react';
import '../styles/dating.css';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null);

  const handleAction = (direction) => {
    if (currentIndex >= PROFILES.length) return;
    setSwipeDir(direction);
    setTimeout(() => {
      setSwipeDir(null);
      setCurrentIndex(prev => prev + 1);
    }, 450);
  };

  const currentProfile = PROFILES[currentIndex];
  const nextProfile = PROFILES[currentIndex + 1];
  const thirdProfile = PROFILES[currentIndex + 2];

  return (
    <div className="dating-page">
      <div className="dating-container">
        <header className="dating-header">
          <h1>❤️ Dating</h1>
          <p>Find your match at VIT</p>
        </header>

        <div className="dating-layout">
          <main className="dating-card-area">
            <div className="dating-card-wrapper">
              {/* Stack behind */}
              {thirdProfile && (
                <div className="dating-card dating-card-stack-2">
                  <div className="dating-card-bg">
                    <div className={`dating-card-gradient ${thirdProfile.gradient}`} />
                    <div className="dating-card-initials">{thirdProfile.initials}</div>
                  </div>
                </div>
              )}
              {nextProfile && (
                <div className="dating-card dating-card-stack-1">
                  <div className="dating-card-bg">
                    <div className={`dating-card-gradient ${nextProfile.gradient}`} />
                    <div className="dating-card-initials">{nextProfile.initials}</div>
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
                    <div className={`dating-card-gradient ${currentProfile.gradient}`} />
                    <div className="dating-card-initials">{currentProfile.initials}</div>
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
          </main>

          <aside className="dating-sidebar">
            <div className="dating-matches-card">
              <h3 className="dating-matches-title">Your Matches</h3>
              <p className="dating-matches-count">{MATCHES.length} matches</p>
              <div className="dating-matches-scroll">
                {MATCHES.map((m, i) => (
                  <div key={i} className="dating-match-item">
                    <div className="dating-match-avatar">{m.initials}</div>
                    <span className="dating-match-name">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dating-setup-card">
              <h3 className="dating-setup-title">Your Dating Profile</h3>
              <div className="dating-setup-item">
                <div className="dating-setup-icon">📸</div>
                <span>Add photos</span>
              </div>
              <div className="dating-setup-item">
                <div className="dating-setup-icon">✍️</div>
                <span>Write a bio</span>
              </div>
              <div className="dating-setup-item">
                <div className="dating-setup-icon">🏷️</div>
                <span>Add interests</span>
              </div>
              <div className="dating-setup-item">
                <div className="dating-setup-icon">🔍</div>
                <span>What you're looking for</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
