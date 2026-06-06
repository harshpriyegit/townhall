import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import '../styles/home.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const MOCK_POSTS = [
  {
    id: 'mock-1',
    user: { fullName: 'Arjun Kumar', username: 'arjun' },
    text: 'Just finished my semester project! 🎉 Can\'t believe how much I learned about machine learning this semester.',
    image: null,
    timestamp: '2h ago',
    likes: 24,
    comments: 5,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-2',
    user: { fullName: 'Priya Sharma', username: 'priya' },
    text: 'Beautiful sunset from the VIT campus today 🌅',
    image: '🌅',
    timestamp: '4h ago',
    likes: 48,
    comments: 12,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-3',
    user: { fullName: 'Rahul Verma', username: 'rahul' },
    text: 'Anyone up for a study session at the library tonight? DSA exam tomorrow 📚',
    image: null,
    timestamp: '5h ago',
    likes: 15,
    comments: 8,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-4',
    user: { fullName: 'Sneha Patel', username: 'sneha' },
    text: 'The new cafeteria menu is actually fire 🔥 They finally added south Indian breakfast!',
    image: null,
    timestamp: '8h ago',
    likes: 67,
    comments: 23,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-5',
    user: { fullName: 'Vikram Singh', username: 'vikram' },
    text: 'Placement season is here! Good luck to all fellow batchmates 🍀',
    image: null,
    timestamp: '1d ago',
    likes: 156,
    comments: 45,
    liked: false,
    saved: false,
  },
]

const POSTS_STORAGE_KEY = 'townhall_posts'

function loadUserPosts() {
  try {
    const stored = localStorage.getItem(POSTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveUserPosts(posts) {
  localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts))
}

function HomePage() {
  const { currentUser } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [postText, setPostText] = useState('')
  const [userPosts, setUserPosts] = useState(loadUserPosts)
  const [feedState, setFeedState] = useState(() => {
    const saved = {}
    MOCK_POSTS.forEach((p) => {
      saved[p.id] = { liked: false, saved: false, likes: p.likes }
    })
    return saved
  })

  const allPosts = [...userPosts, ...MOCK_POSTS]

  const handlePost = useCallback(() => {
    if (!postText.trim()) return

    const newPost = {
      id: `user-${Date.now()}`,
      user: {
        fullName: currentUser?.fullName || 'You',
        username: currentUser?.username || 'you',
      },
      text: postText.trim(),
      image: null,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      liked: false,
      saved: false,
    }

    const updated = [newPost, ...userPosts]
    setUserPosts(updated)
    saveUserPosts(updated)
    setPostText('')
    setExpanded(false)
  }, [postText, currentUser, userPosts])

  const toggleLike = useCallback((postId) => {
    setFeedState((prev) => {
      const current = prev[postId] || { liked: false, saved: false, likes: 0 }
      return {
        ...prev,
        [postId]: {
          ...current,
          liked: !current.liked,
          likes: current.liked ? current.likes - 1 : current.likes + 1,
        },
      }
    })
  }, [])

  const toggleSave = useCallback((postId) => {
    setFeedState((prev) => {
      const current = prev[postId] || { liked: false, saved: false, likes: 0 }
      return {
        ...prev,
        [postId]: { ...current, saved: !current.saved },
      }
    })
  }, [])

  return (
    <div className="home-page">
      {/* ── Create Post ──────────────────────────────────── */}
      <div className="create-post-card">
        <div className="create-post-top">
          <div className="create-post-avatar">
            {getInitials(currentUser?.fullName)}
          </div>
          {!expanded ? (
            <div
              className="create-post-input-trigger"
              onClick={() => setExpanded(true)}
            >
              What's on your mind?
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}
        </div>

        {expanded && (
          <div className="create-post-expanded">
            <textarea
              className="create-post-textarea"
              placeholder="What's on your mind?"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              autoFocus
            />
            <div className="create-post-actions">
              <div className="create-post-btns">
                <button className="create-post-action-btn" type="button">
                  <span className="action-icon">📷</span>
                  <span>Photo</span>
                </button>
                <button className="create-post-action-btn" type="button">
                  <span className="action-icon">🎥</span>
                  <span>Video</span>
                </button>
                <button className="create-post-action-btn" type="button">
                  <span className="action-icon">📍</span>
                  <span>Location</span>
                </button>
              </div>
              <button
                className="create-post-submit"
                onClick={handlePost}
                disabled={!postText.trim()}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Feed ─────────────────────────────────────────── */}
      {allPosts.map((post, index) => {
        const state = feedState[post.id] || {
          liked: post.liked,
          saved: post.saved,
          likes: post.likes,
        }

        return (
          <article key={post.id} className="feed-post" style={{ opacity: 0, animationFillMode: 'forwards' }}>
            <div className="post-header">
              <div className="post-avatar">
                {getInitials(post.user.fullName)}
              </div>
              <div className="post-user-info">
                <div className="post-user-name">{post.user.fullName}</div>
                <div className="post-user-meta">
                  <span>@{post.user.username}</span>
                  <span className="post-dot" />
                  <span>{post.timestamp}</span>
                </div>
              </div>
              <button className="post-more-btn" title="More">⋯</button>
            </div>

            <div className="post-content">
              <p className="post-text">{post.text}</p>
              {post.image && (
                <div className="post-image">{post.image}</div>
              )}
            </div>

            <div className="post-actions">
              <button
                className={`post-action-btn${state.liked ? ' liked' : ''}`}
                onClick={() => toggleLike(post.id)}
              >
                <span className="action-icon">{state.liked ? '❤️' : '🤍'}</span>
                <span>{state.likes}</span>
              </button>
              <button className="post-action-btn">
                <span className="action-icon">💬</span>
                <span>{post.comments}</span>
              </button>
              <button className="post-action-btn">
                <span className="action-icon">🔄</span>
              </button>
              <button
                className={`post-action-btn${state.saved ? ' saved' : ''}`}
                onClick={() => toggleSave(post.id)}
                style={{ marginLeft: 'auto' }}
              >
                <span className="action-icon">{state.saved ? '🔖' : '📑'}</span>
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default HomePage
