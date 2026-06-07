import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { postsAPI } from '../utils/api'
import '../styles/home.css'

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

const MOCK_POSTS = [
  {
    id: 'mock-1',
    user: { fullName: 'Arjun Kumar', username: 'arjun' },
    content: 'Just finished my semester project! 🎉 Can\'t believe how much I learned about machine learning this semester.',
    text: 'Just finished my semester project! 🎉 Can\'t believe how much I learned about machine learning this semester.',
    image: null,
    timestamp: '2h ago',
    likes: 24,
    likesCount: 24,
    commentsCount: 5,
    comments: 5,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-2',
    user: { fullName: 'Priya Sharma', username: 'priya' },
    content: 'Beautiful sunset from the VIT campus today 🌅',
    text: 'Beautiful sunset from the VIT campus today 🌅',
    image: '🌅',
    timestamp: '4h ago',
    likes: 48,
    likesCount: 48,
    commentsCount: 12,
    comments: 12,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-3',
    user: { fullName: 'Rahul Verma', username: 'rahul' },
    content: 'Anyone up for a study session at the library tonight? DSA exam tomorrow 📚',
    text: 'Anyone up for a study session at the library tonight? DSA exam tomorrow 📚',
    image: null,
    timestamp: '5h ago',
    likes: 15,
    likesCount: 15,
    commentsCount: 8,
    comments: 8,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-4',
    user: { fullName: 'Sneha Patel', username: 'sneha' },
    content: 'The new cafeteria menu is actually fire 🔥 They finally added south Indian breakfast!',
    text: 'The new cafeteria menu is actually fire 🔥 They finally added south Indian breakfast!',
    image: null,
    timestamp: '8h ago',
    likes: 67,
    likesCount: 67,
    commentsCount: 23,
    comments: 23,
    liked: false,
    saved: false,
  },
  {
    id: 'mock-5',
    user: { fullName: 'Vikram Singh', username: 'vikram' },
    content: 'Placement season is here! Good luck to all fellow batchmates 🍀',
    text: 'Placement season is here! Good luck to all fellow batchmates 🍀',
    image: null,
    timestamp: '1d ago',
    likes: 156,
    likesCount: 156,
    commentsCount: 45,
    comments: 45,
    liked: false,
    saved: false,
  },
]

function HomePage() {
  const { currentUser } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState([])
  const [isLoadingFeed, setIsLoadingFeed] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [feedState, setFeedState] = useState({})

  // Fetch posts from API on mount
  useEffect(() => {
    let cancelled = false

    async function fetchPosts() {
      try {
        const data = await postsAPI.getAll(1)
        if (cancelled) return
        const apiPosts = (data.posts || data || []).map((p) => ({
          id: p._id || p.id,
          user: p.author || p.user || { fullName: 'Unknown', username: 'unknown' },
          content: p.content || p.text || '',
          text: p.content || p.text || '',
          image: p.imageUrl || p.image || null,
          timestamp: timeAgo(p.createdAt) || p.timestamp || '',
          likes: p.likesCount ?? p.likes ?? 0,
          likesCount: p.likesCount ?? p.likes ?? 0,
          commentsCount: p.commentsCount ?? p.comments ?? 0,
          comments: p.commentsCount ?? p.comments ?? 0,
          liked: p.liked || false,
          saved: false,
        }))
        setPosts(apiPosts.length > 0 ? apiPosts : MOCK_POSTS)
        // Build initial feedState
        const state = {}
        apiPosts.forEach((p) => {
          state[p.id] = { liked: p.liked, saved: false, likes: p.likesCount }
        })
        setFeedState(state)
      } catch (err) {
        if (cancelled) return
        console.warn('Failed to fetch posts, using mock data:', err.message)
        setPosts(MOCK_POSTS)
        const state = {}
        MOCK_POSTS.forEach((p) => {
          state[p.id] = { liked: false, saved: false, likes: p.likes }
        })
        setFeedState(state)
        setFeedError('')
      } finally {
        if (!cancelled) setIsLoadingFeed(false)
      }
    }

    fetchPosts()
    return () => { cancelled = true }
  }, [])

  const handlePost = useCallback(async () => {
    if (!postText.trim()) return
    setIsPosting(true)

    try {
      const data = await postsAPI.create({ content: postText.trim() })
      const newPost = {
        id: data.post?._id || data._id || `user-${Date.now()}`,
        user: data.post?.author || currentUser || { fullName: 'You', username: 'you' },
        content: postText.trim(),
        text: postText.trim(),
        image: null,
        timestamp: 'Just now',
        likes: 0,
        likesCount: 0,
        commentsCount: 0,
        comments: 0,
        liked: false,
        saved: false,
      }
      setPosts((prev) => [newPost, ...prev])
      setPostText('')
      setExpanded(false)
    } catch (err) {
      console.warn('Failed to create post via API, saving locally:', err.message)
      // Fallback — create local post
      const newPost = {
        id: `user-${Date.now()}`,
        user: {
          fullName: currentUser?.fullName || 'You',
          username: currentUser?.username || 'you',
        },
        content: postText.trim(),
        text: postText.trim(),
        image: null,
        timestamp: 'Just now',
        likes: 0,
        likesCount: 0,
        commentsCount: 0,
        comments: 0,
        liked: false,
        saved: false,
      }
      setPosts((prev) => [newPost, ...prev])
      setPostText('')
      setExpanded(false)
    } finally {
      setIsPosting(false)
    }
  }, [postText, currentUser])

  const toggleLike = useCallback(async (postId) => {
    // Optimistic update
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

    try {
      await postsAPI.like(postId)
    } catch (err) {
      // Revert on failure
      console.warn('Like API failed:', err.message)
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
    }
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

  // Loading skeleton
  if (isLoadingFeed) {
    return (
      <div className="home-page">
        <div className="create-post-card" style={{ opacity: 0.5 }}>
          <div className="create-post-top">
            <div className="create-post-avatar" style={{ background: '#F0F0F0' }} />
            <div className="create-post-input-trigger" style={{ background: '#F5F5F5', color: 'transparent' }}>
              Loading...
            </div>
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <article key={i} className="feed-post" style={{ opacity: 1 }}>
            <div className="post-header">
              <div className="post-avatar" style={{ background: '#F0F0F0', color: 'transparent' }}>??</div>
              <div className="post-user-info">
                <div style={{ width: '120px', height: '14px', background: '#F0F0F0', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ width: '80px', height: '12px', background: '#F5F5F5', borderRadius: '4px' }} />
              </div>
            </div>
            <div className="post-content">
              <div style={{ width: '100%', height: '14px', background: '#F5F5F5', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ width: '75%', height: '14px', background: '#F5F5F5', borderRadius: '4px' }} />
            </div>
          </article>
        ))}
      </div>
    )
  }

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
              disabled={isPosting}
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
                disabled={!postText.trim() || isPosting}
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Feed ─────────────────────────────────────────── */}
      {posts.map((post, index) => {
        const state = feedState[post.id] || {
          liked: post.liked,
          saved: post.saved || false,
          likes: post.likesCount || post.likes || 0,
        }

        return (
          <article key={post.id} className="feed-post" style={{ opacity: 0, animationFillMode: 'forwards' }}>
            <div className="post-header">
              <div className="post-avatar">
                {getInitials(post.user?.fullName)}
              </div>
              <div className="post-user-info">
                <div className="post-user-name">{post.user?.fullName}</div>
                <div className="post-user-meta">
                  <span>@{post.user?.username}</span>
                  <span className="post-dot" />
                  <span>{post.timestamp}</span>
                </div>
              </div>
              <button className="post-more-btn" title="More">⋯</button>
            </div>

            <div className="post-content">
              <p className="post-text">{post.content || post.text}</p>
              {post.image && typeof post.image === 'string' && post.image.startsWith('http') ? (
                <div className="post-image">
                  <img src={post.image} alt="" style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '12px' }} />
                </div>
              ) : post.image ? (
                <div className="post-image">{post.image}</div>
              ) : null}
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
                <span>{post.commentsCount || post.comments || 0}</span>
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
