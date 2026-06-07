import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI, uploadAPI, postsAPI } from '../utils/api'
import '../styles/profile.css'
import '../styles/home.css'

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin


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

function resolveUrl(avatar) {
  if (!avatar) return null
  if (avatar.startsWith('http')) return avatar
  return `${API_BASE}${avatar}`
}

const BIO_MAX = 160

function ProfilePage() {
  const { username: paramUsername } = useParams()
  const { currentUser, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatarPreview, setEditAvatarPreview] = useState(null)
  const [editAvatarFile, setEditAvatarFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)

  // Create Post state (for Profile Page)
  const [postExpanded, setPostExpanded] = useState(false)
  const [postText, setPostText] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [feedState, setFeedState] = useState({})

  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

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
          postsCount: user.postCount ?? user.postsCount ?? 0,
        })
        setIsFollowing(user.isFollowing || false)

        // If user has posts from API
        if (user.posts && user.posts.length > 0) {
          const apiPosts = user.posts.map((p) => ({
            id: p._id || p.id,
            text: p.content || p.text || '',
            image: p.imageUrl || p.image || null,
            video: p.videoUrl || p.video || null,
            timestamp: timeAgo(p.createdAt) || p.timestamp || '',
            likes: p.likesCount ?? p.likes ?? 0,
            comments: p.commentsCount ?? p.comments ?? 0,
            liked: p.liked || false,
          }))
          setPosts(apiPosts)

          const state = {}
          apiPosts.forEach((p) => {
            state[p.id] = { liked: p.liked, saved: false, likes: p.likes }
          })
          setFeedState(state)
        }
      } catch (err) {
        console.warn('Failed to fetch profile, using local data:', err.message)
        if (cancelled) return
        setPosts([])

        if (isOwnProfile && currentUser) {
          setProfileUser({
            _id: currentUser._id || currentUser.id,
            fullName: currentUser.fullName || currentUser.username,
            username: currentUser.username,
            bio: currentUser.bio || '',
            avatar: currentUser.avatar || null,
            followers: currentUser.followersCount ?? 0,
            following: currentUser.followingCount ?? 0,
            postsCount: currentUser.postsCount ?? 0,
          })
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

  // Start edit mode
  const handleStartEdit = () => {
    setEditFullName(profileUser?.fullName || '')
    setEditBio(profileUser?.bio || '')
    setEditAvatarPreview(null)
    setEditAvatarFile(null)
    setSaveError('')
    setSaveSuccess(false)
    setIsEditing(true)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditAvatarPreview(null)
    setEditAvatarFile(null)
    setSaveError('')
    setSaveSuccess(false)
  }

  // File input change
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file)
    setEditAvatarPreview(previewUrl)
    setEditAvatarFile(file)

    // Upload right away
    setIsUploading(true)
    try {
      const result = await uploadAPI.avatar(file)
      // Update local state with the new URL from server
      setProfileUser((prev) => prev ? { ...prev, avatar: result.avatarUrl } : prev)
      updateUser({ avatar: result.avatarUrl })
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setSaveError('Avatar upload failed. Try again.')
      // Revert preview
      setEditAvatarPreview(null)
      setEditAvatarFile(null)
    } finally {
      setIsUploading(false)
    }

    // Reset input value so same file can be re-selected
    e.target.value = ''
  }

  // Save profile
  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const result = await usersAPI.updateProfile({
        fullName: editFullName.trim(),
        bio: editBio.trim(),
      })

      const updated = result.user || result
      setProfileUser((prev) => ({
        ...prev,
        fullName: updated.fullName || editFullName.trim(),
        bio: updated.bio ?? editBio.trim(),
      }))
      updateUser({
        fullName: updated.fullName || editFullName.trim(),
        bio: updated.bio ?? editBio.trim(),
      })

      setSaveSuccess(true)
      setTimeout(() => {
        setIsEditing(false)
        setSaveSuccess(false)
      }, 1200)
    } catch (err) {
      console.error('Save profile error:', err)
      setSaveError(err.message || 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Create Post Handlers for Profile Page
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

  const handlePost = async () => {
    if (!postText.trim() && !selectedImage && !selectedVideo) return
    setIsPosting(true)
    setUploadError('')

    let imageUrl = null
    let videoUrl = null

    try {
      if (selectedImage) {
        const result = await uploadAPI.postImage(selectedImage)
        imageUrl = result.imageUrl
      } else if (selectedVideo) {
        const result = await uploadAPI.postVideo(selectedVideo)
        videoUrl = result.videoUrl
      }

      const data = await postsAPI.create({
        content: postText.trim(),
        imageUrl,
        videoUrl
      })

      const newPost = {
        id: data.id || data.post?.id || `user-${Date.now()}`,
        text: postText.trim(),
        image: imageUrl,
        video: videoUrl,
        timestamp: 'Just now',
        likes: 0,
        comments: 0,
        liked: false,
      }

      setPosts((prev) => [newPost, ...prev])

      setFeedState((prev) => ({
        ...prev,
        [newPost.id]: { liked: false, saved: false, likes: 0 }
      }))

      setProfileUser((prev) => prev ? { ...prev, postsCount: (prev.postsCount || 0) + 1 } : prev)

      setPostText('')
      setSelectedImage(null)
      setSelectedVideo(null)
      setImagePreview(null)
      setVideoPreview(null)
      setPostExpanded(false)
    } catch (err) {
      console.error('Failed to create post on profile page:', err)
      setUploadError(err.message || 'Failed to submit post. Please try again.')
    } finally {
      setIsPosting(false)
    }
  }

  const toggleLike = useCallback(async (postId) => {
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

  const handleFollow = async () => {
    if (!profileUser?._id) {
      setIsFollowing(!isFollowing)
      return
    }

    setFollowLoading(true)
    const prevState = isFollowing

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

  // Determine avatar display URL
  const displayAvatar = editAvatarPreview || resolveUrl(profileUser?.avatar)

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
            {/* Avatar - clickable if own profile or in edit mode */}
            {isEditing || isOwnProfile ? (
              <div
                className="profile-avatar profile-avatar-edit"
                onClick={() => fileInputRef.current?.click()}
                title="Upload/Change profile photo"
              >
                {isUploading && (
                  <div className="profile-avatar-overlay uploading">
                    <div className="profile-upload-spinner" />
                  </div>
                )}
                {!isUploading && (
                  <div className="profile-avatar-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                )}
                {displayAvatar ? (
                  <img src={displayAvatar} alt="" />
                ) : (
                  getInitials(profileUser?.fullName)
                )}
              </div>
            ) : (
              <div className="profile-avatar">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="" />
                ) : (
                  getInitials(profileUser?.fullName)
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarFileChange}
            style={{ display: 'none' }}
          />

          {/* ── Info section: View or Edit mode ─── */}
          {isEditing ? (
            <div className="profile-edit-form">
              <div className="profile-edit-field">
                <label className="profile-edit-label">Full Name</label>
                <input
                  className="profile-edit-input"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={50}
                />
              </div>

              <div className="profile-edit-field">
                <label className="profile-edit-label">Bio</label>
                <textarea
                  className="profile-edit-textarea"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, BIO_MAX))}
                  placeholder="Tell the world about yourself..."
                  maxLength={BIO_MAX}
                  rows={3}
                />
                <span className={`profile-char-count${editBio.length >= BIO_MAX ? ' at-limit' : ''}`}>
                  {editBio.length}/{BIO_MAX}
                </span>
              </div>

              {saveError && (
                <div className="profile-edit-error">{saveError}</div>
              )}

              <div className="profile-edit-actions">
                <button
                  className="profile-cancel-btn"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="profile-save-btn"
                  onClick={handleSaveProfile}
                  disabled={isSaving || isUploading}
                >
                  {isSaving ? (
                    <span className="profile-btn-loading">
                      <span className="profile-btn-spinner" />
                      Saving…
                    </span>
                  ) : saveSuccess ? (
                    <span className="profile-btn-success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Saved!
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          ) : (
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

              <div style={{ display: 'flex', gap: '8px' }}>
                {isOwnProfile ? (
                  <>
                    <button className="profile-edit-btn" onClick={handleStartEdit}>Edit Profile</button>
                    <button className="profile-edit-btn" onClick={() => fileInputRef.current?.click()}>
                      Upload Photo
                    </button>
                  </>
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
          )}

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

      {/* ── Posts Tab Content ────────────────────────── */}
      {activeTab === 'posts' && (
        <div className="profile-posts-tab">
          {/* Create Post Card (Only for Own Profile) */}
          {isOwnProfile && (
            <div className="create-post-card" style={{ marginBottom: '24px' }}>
              <div className="create-post-top">
                <div className="create-post-avatar">
                  {getInitials(currentUser?.fullName)}
                </div>
                {!postExpanded ? (
                  <div
                    className="create-post-input-trigger"
                    onClick={() => setPostExpanded(true)}
                  >
                    What's on your mind?
                  </div>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
              </div>

              {postExpanded && (
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
          )}

          {posts.length === 0 ? (
            <div className="profile-posts-empty">
              <div className="profile-posts-empty-icon">🏛️</div>
              <p>No posts yet. Share something with the world!</p>
            </div>
          ) : (
            <div className="profile-posts">
              {posts.map((post) => {
                const state = feedState[post.id] || {
                  liked: post.liked || false,
                  saved: false,
                  likes: post.likes || 0,
                }
                return (
                  <article key={post.id} className="feed-post">
                    <div className="post-header">
                      <div className="post-avatar">
                        {profileUser?.avatar ? (
                          <img src={resolveUrl(profileUser.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          getInitials(profileUser?.fullName)
                        )}
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
                      
                      {/* Image rendering */}
                      {post.image && (
                        <div className="post-image" style={{ display: 'block', height: 'auto', background: 'none' }}>
                          <img src={resolveUrl(post.image)} alt="" style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '12px', marginTop: '12px', objectFit: 'contain' }} />
                        </div>
                      )}

                      {/* Video rendering */}
                      {post.video && (
                        <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden', background: '#000', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
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
          )}
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
