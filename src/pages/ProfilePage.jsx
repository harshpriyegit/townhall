import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/profile.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const MOCK_USER_POSTS = [
  {
    id: 'profile-1',
    text: 'Excited to start building with React and Vite! The DX is incredible. 🚀',
    timestamp: '3h ago',
    likes: 18,
    comments: 4,
  },
  {
    id: 'profile-2',
    text: 'Just completed my internship at a startup. What an experience! Grateful for the team. 💼',
    timestamp: '2d ago',
    likes: 89,
    comments: 15,
  },
  {
    id: 'profile-3',
    text: 'Weekend vibes at the campus lake 🏞️ Nothing beats a good sunset after a long week.',
    timestamp: '5d ago',
    likes: 54,
    comments: 8,
  },
]

function ProfilePage() {
  const { username: paramUsername } = useParams()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('posts')
  const [isFollowing, setIsFollowing] = useState(false)

  const isOwnProfile = !paramUsername || paramUsername === currentUser?.username

  const profileUser = isOwnProfile
    ? currentUser
    : {
        fullName: paramUsername?.charAt(0).toUpperCase() + paramUsername?.slice(1) || 'User',
        username: paramUsername || 'user',
        bio: 'Hey there! I\'m using TownHall.',
        followers: 128,
        following: 95,
        avatar: null,
      }

  const posts = MOCK_USER_POSTS
  const postsCount = posts.length

  return (
    <div className="profile-page">
      {/* ── Profile Header ──────────────────────────────── */}
      <div className="profile-header-card">
        <div className="profile-cover" />
        <div className="profile-header-body">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar">
              {profileUser?.avatar ? (
                <img src={profileUser.avatar} alt="" />
              ) : (
                getInitials(profileUser?.fullName)
              )}
            </div>
          </div>

          <div className="profile-info">
            <div>
              <h1 className="profile-name">{profileUser?.fullName}</h1>
              <p className="profile-handle">@{profileUser?.username}</p>
              {(profileUser?.bio || isOwnProfile) && (
                <p className="profile-bio">
                  {profileUser?.bio || 'No bio yet. Tell the world about yourself!'}
                </p>
              )}
            </div>

            <div>
              {isOwnProfile ? (
                <button className="profile-edit-btn">Edit Profile</button>
              ) : (
                <button
                  className={`profile-follow-btn${isFollowing ? ' following' : ''}`}
                  onClick={() => setIsFollowing(!isFollowing)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">{postsCount}</span>
              <span className="profile-stat-label">Posts</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{profileUser?.followers ?? 0}</span>
              <span className="profile-stat-label">Followers</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{profileUser?.following ?? 0}</span>
              <span className="profile-stat-label">Following</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="profile-tabs">
        {['Posts', 'Liked', 'Saved'].map((tab) => (
          <button
            key={tab}
            className={`profile-tab${activeTab === tab.toLowerCase() ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.toLowerCase())}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Posts ────────────────────────────────────────── */}
      {activeTab === 'posts' && posts.length > 0 && (
        <div className="profile-posts">
          {posts.map((post) => (
            <article key={post.id} className="feed-post">
              <div className="post-header">
                <div className="post-avatar">
                  {getInitials(profileUser?.fullName)}
                </div>
                <div className="post-user-info">
                  <div className="post-user-name">{profileUser?.fullName}</div>
                  <div className="post-user-meta">
                    <span>@{profileUser?.username}</span>
                    <span className="post-dot" />
                    <span>{post.timestamp}</span>
                  </div>
                </div>
              </div>
              <div className="post-content">
                <p className="post-text">{post.text}</p>
              </div>
              <div className="post-actions">
                <button className="post-action-btn">
                  <span className="action-icon">🤍</span>
                  <span>{post.likes}</span>
                </button>
                <button className="post-action-btn">
                  <span className="action-icon">💬</span>
                  <span>{post.comments}</span>
                </button>
                <button className="post-action-btn">
                  <span className="action-icon">🔄</span>
                </button>
                <button className="post-action-btn" style={{ marginLeft: 'auto' }}>
                  <span className="action-icon">📑</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'liked' && (
        <div className="profile-posts-empty">
          <div className="profile-posts-empty-icon">❤️</div>
          <p>Posts you've liked will appear here</p>
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="profile-posts-empty">
          <div className="profile-posts-empty-icon">🔖</div>
          <p>Posts you've saved will appear here</p>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
