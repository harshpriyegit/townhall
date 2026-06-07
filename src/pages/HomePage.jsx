import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { postsAPI, uploadAPI } from '../utils/api'
import '../styles/home.css'

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin

function resolveUrl(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

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

function HomePage() {
  const { currentUser } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState([])
  const [isLoadingFeed, setIsLoadingFeed] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [feedState, setFeedState] = useState({})

  // Image & Video attachment states
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

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
          video: p.videoUrl || p.video || null,
          timestamp: timeAgo(p.createdAt) || p.timestamp || '',
          likes: p.likesCount ?? p.likes ?? 0,
          likesCount: p.likesCount ?? p.likes ?? 0,
          commentsCount: p.commentsCount ?? p.comments ?? 0,
          comments: p.commentsCount ?? p.comments ?? 0,
          liked: p.liked || false,
          saved: false,
        }))
        setPosts(apiPosts)
        // Build initial feedState
        const state = {}
        apiPosts.forEach((p) => {
          state[p.id] = { liked: p.liked, saved: false, likes: p.likesCount }
        })
        setFeedState(state)
      } catch (err) {
        if (cancelled) return
        console.warn('Failed to fetch posts, showing empty feed:', err.message)
        setPosts([])
        setFeedState({})
        setFeedError('')
      } finally {
        if (!cancelled) setIsLoadingFeed(false)
      }
    }

    fetchPosts()
    return () => { cancelled = true }
  }, [])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    setSelectedVideo(null)
    setVideoPreview(null)
    setImagePreview(URL.createObjectURL(file))
    setUploadError('')
  }

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Enforce 10-second limit client-side
    const videoEl = document.createElement('video')
    videoEl.preload = 'metadata'
    videoEl.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoEl.src)
      if (videoEl.duration > 10.5) {
        setUploadError('Videos under "Real Time" are strictly limited to 10 seconds!')
        e.target.value = ''
        return
      }
      setSelectedVideo(file)
      setSelectedImage(null)
      setImagePreview(null)
      setVideoPreview(URL.createObjectURL(file))
      setUploadError('')
    }
    videoEl.src = URL.createObjectURL(file)
  }

  const removeAttachment = () => {
    setSelectedImage(null)
    setSelectedVideo(null)
    setImagePreview(null)
    setVideoPreview(null)
    setUploadError('')
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const handlePost = useCallback(async () => {
    if (!postText.trim() && !selectedImage && !selectedVideo) return
    setIsPosting(true)
    setUploadError('')

    let imageUrl = null
    let videoUrl = null

    try {
      // 1. Upload files first if selected
      if (selectedImage) {
        const result = await uploadAPI.postImage(selectedImage)
        imageUrl = result.imageUrl
      } else if (selectedVideo) {
        const result = await uploadAPI.postVideo(selectedVideo)
        videoUrl = result.videoUrl
      }

      // 2. Create post
      const data = await postsAPI.create({
        content: postText.trim(),
        imageUrl,
        videoUrl
      })

      const newPost = {
        id: data.id || data.post?.id || `user-${Date.now()}`,
        user: data.author || currentUser || { fullName: 'You', username: 'you' },
        content: postText.trim(),
        text: postText.trim(),
        image: imageUrl,
        video: videoUrl,
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
      setSelectedImage(null)
      setSelectedVideo(null)
      setImagePreview(null)
      setVideoPreview(null)
      setExpanded(false)
    } catch (err) {
      console.error('Failed to create post:', err)
      setUploadError(err.message || 'Failed to submit post. Please try again.')
    } finally {
      setIsPosting(false)
    }
  }, [postText, selectedImage, selectedVideo, currentUser])

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

            {/* Preview image or video */}
            {(imagePreview || videoPreview) && (
              <div style={{ position: 'relative', marginTop: '12px', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%' }}>
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px' }} />
                )}
                {videoPreview && (
                  <video src={videoPreview} controls style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', background: '#000', borderRadius: '8px' }} />
                )}
                <button
                  type="button"
                  onClick={removeAttachment}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {uploadError && (
              <div style={{ marginTop: '10px', color: '#DC2626', fontSize: '0.85rem', fontWeight: 500 }}>
                ⚠️ {uploadError}
              </div>
            )}

            <div className="create-post-actions">
              <div className="create-post-btns">
                <button
                  className="create-post-action-btn"
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <span className="action-icon">📷</span>
                  <span>Photo</span>
                </button>
                <button
                  className="create-post-action-btn"
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <span className="action-icon">⚡</span>
                  <span>Real Time (10s)</span>
                </button>

                {/* Hidden File Inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoChange}
                  style={{ display: 'none' }}
                />
              </div>

              <button
                className="create-post-submit"
                onClick={handlePost}
                disabled={(!postText.trim() && !selectedImage && !selectedVideo) || isPosting}
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Feed ─────────────────────────────────────────── */}
      {posts.length === 0 ? (
        <div className="feed-empty">
          <div className="feed-empty-icon">🏛️</div>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        posts.map((post) => {
          const state = feedState[post.id] || {
            liked: post.liked,
            saved: post.saved || false,
            likes: post.likesCount || post.likes || 0,
          }

          return (
            <article key={post.id} className="feed-post" style={{ opacity: 1 }}>
              <div className="post-header">
                <div className="post-avatar">
                  {post.user?.avatar ? (
                    <img src={resolveUrl(post.user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    getInitials(post.user?.fullName)
                  )}
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
                
                {/* Image rendering */}
                {post.image && (
                  <div className="post-image" style={{ display: 'block', height: 'auto', background: 'none' }}>
                    <img src={resolveUrl(post.image)} alt="" style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '12px', marginTop: '12px', objectFit: 'contain' }} />
                  </div>
                )}

                {/* Video rendering */}
                {post.video && (
                  <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden', background: '#000', maxFormat: '100%', display: 'flex', justifyContent: 'center' }}>
                    <video src={resolveUrl(post.video)} controls style={{ width: '100%', maxHeight: '400px', borderRadius: '12px' }} />
                  </div>
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
        })
      )}
    </div>
  )
}

export default HomePage
