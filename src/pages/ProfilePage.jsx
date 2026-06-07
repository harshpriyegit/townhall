import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI } from '../utils/api'
import '../styles/profile.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return date.toLocaleDateString()
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
  const [profileUser, setProfileUser] = useState(null)
  const [posts, setPosts] = useState(MOCK_USER_POSTS)
  const [isLoading, setIsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  const isOwnProfile = !paramUsername || paramUsername === currentUser?.username

  useEffect(() => {
    let cancelled = false

    async function fetchProfile() {
      setIsLoading(true)
      try {
        let data
        if (isOwnProfile) {
          data = await usersAPI.getMe()
        } else {
          data = await usersAPI.getByUsername(paramUsername)
        }
        if (cancelled) return

        const user = data.user || data
        setProfileUser({
          _id: user._id || user.id,
          fullName: user.fullName || user.username,
          username: user.username,
          bio: user.bio || '',
          avatar: user.avatar || user.profilePicture || null,
          followers: user.followersCount ?? user.followers ?? 0,
          following: user.followingCount ?? user.following ?? 0,
          postsCount: user.postsCount ?? 0,
        })
        setIsFollowing(user.isFollowing || false)

        // If user has posts from API
        if (user.posts && user.posts.length > 0) {
          setPosts(user.posts.map((p) => ({
            id: p._id || p.id,
            text: p.content || p.text || '',
            timestamp: timeAgo(p.createdAt) || p.timestamp || '',
            likes: p.likesCount ?? p.likes ?? 0,
            comments: p.commentsCount ?? p.comments ?? 0,
          })))
        }
      } catch (err) {
        console.warn('Failed to fetch profile, using local data:', err.message)
        if (cancelled) return
        // Fallback to local user data
        if (isOwnProfile && currentUser) {
          setProfileUser(currentUser)
        } else {
          setProfileUser({
            fullName: paramUsername?.charAt(0).toUpperCase() + paramUsername?.slice(1) || 'User',
            username: paramUsername || 'user',
            bio: 'Hey there! I\'m using TownHall.',
            followers: 128,
            following: 95,
            avatar: null,
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchProfile()
    return () => { cancelled = true }
  }, [paramUsername, isOwnProfile, currentUser])

  const handleFollow = async () => {
    if (!profileUser?._id) {
      setIsFollowing(!isFollowing)
      return
    }

    setFollowLoading(true)
    const prevState = isFollowing

    // Optimistic
    setIsFollowing(!prevState)
    setProfileUser((prev) => prev ? {
      ...prev,
      followers: prevState ? (prev.followers || 1) - 1 : (prev.followers || 0) + 1,
    } : prev)

    try {
      await usersAPI.follow(profileUser._id)
    } catch (err) {
      console.warn('Follow API failed:', err.message)
      setIsFollowing(prevState)
      setProfileUser((prev) => prev ? {
        ...prev,
        followers: prevState ? (prev.followers || 0) + 1 : (prev.followers || 1) - 1,
      } : prev)
    } finally {
      setFollowLoading(false)
    }
  }

  const postsCount = profileUser?.postsCount ?? posts.length

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-header-card">
          <div className="profile-cover" />
          <div className="profile-header-body">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar" style={{ background: '#F0F0F0', color: 'transparent' }}>??</div>
            </div>
            <div className="profile-info">
              <div>
                <div style={{ width: '160px', height: '22px', background: '#F0F0F0', borderRadius: '6px', marginBottom: '8px' }} />
                <div style={{ width: '100px', height: '16px', background: '#F5F5F5', borderRadius: '4px' }} />
              </div>
            </div>
            <div className="profile-stats">
              {[1, 2, 3].map((i) => (
                <div key={i} className="profile-stat">
                  <div style={{ width: '30px', height: '18px', background: '#F0F0F0', borderRadius: '4px', margin: '0 auto 4px' }} />
                  <div style={{ width: '50px', height: '12px', background: '#F5F5F5', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
                  onClick={handleFollow}
                  disabled={followLoading}
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
