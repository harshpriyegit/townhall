const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://townhall-i390.onrender.com/api'
)

// Get token from localStorage
function getToken() {
  return localStorage.getItem('townhall_token')
}

// Generic fetch wrapper with auth header
async function apiFetch(endpoint, options = {}) {
  const token = getToken()
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  }

  const response = await fetch(`${API_URL}${endpoint}`, config)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Something went wrong')
  }

  return data
}

// Auth API
export const authAPI = {
  signup: (data) => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiFetch('/auth/me'),
}

// Posts API
export const postsAPI = {
  getAll: (page = 1) => apiFetch(`/posts?page=${page}&limit=10`),
  create: (data) => apiFetch('/posts', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/posts/${id}`, { method: 'DELETE' }),
  like: (id) => apiFetch(`/posts/${id}/like`, { method: 'POST' }),
  getComments: (id) => apiFetch(`/posts/${id}/comments`),
  addComment: (id, content) => apiFetch(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
}

// Users API
export const usersAPI = {
  getMe: () => apiFetch('/users/me'),
  getByUsername: (username) => apiFetch(`/users/${username}`),
  updateProfile: (data) => apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  follow: (id) => apiFetch(`/users/${id}/follow`, { method: 'POST' }),
  search: (q) => apiFetch(`/users/search?q=${q}`),
}

// Messages API
export const messagesAPI = {
  getConversations: () => apiFetch('/messages/conversations'),
  getMessages: (userId) => apiFetch(`/messages/${userId}`),
  send: (userId, content) => apiFetch(`/messages/${userId}`, { method: 'POST', body: JSON.stringify({ content }) }),
}

// Anonymous API
export const anonymousAPI = {
  getAll: () => apiFetch('/anonymous'),
  create: (content) => apiFetch('/anonymous', { method: 'POST', body: JSON.stringify({ content }) }),
  react: (id, type) => apiFetch(`/anonymous/${id}/react`, { method: 'POST', body: JSON.stringify({ type }) }),
}

// Dating API
export const datingAPI = {
  getProfile: () => apiFetch('/dating/profile'),
  updateProfile: (data) => apiFetch('/dating/profile', { method: 'POST', body: JSON.stringify(data) }),
  discover: () => apiFetch('/dating/discover'),
  swipe: (swipedId, action) => apiFetch('/dating/swipe', { method: 'POST', body: JSON.stringify({ swipedId, action }) }),
  getMatches: () => apiFetch('/dating/matches'),
}

// Cuffing API
export const cuffingAPI = {
  getEvents: () => apiFetch('/cuffing/events'),
  rsvp: (eventId, status) => apiFetch(`/cuffing/events/${eventId}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }),
  getParticipants: (eventId) => apiFetch(`/cuffing/events/${eventId}/participants`),
  sendCuff: (eventId, receiverId) => apiFetch(`/cuffing/events/${eventId}/cuff`, { method: 'POST', body: JSON.stringify({ receiverId }) }),
  getRequests: () => apiFetch('/cuffing/requests'),
  updateRequest: (id, status) => apiFetch(`/cuffing/requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
}

// Notifications API
export const notificationsAPI = {
  getAll: () => apiFetch('/notifications'),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'PUT' }),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),
}

// Upload API (uses FormData, not JSON — do NOT set Content-Type header)
export const uploadAPI = {
  avatar: async (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    const token = getToken()
    const response = await fetch(`${API_URL}/upload/avatar`, {
      method: 'POST',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Upload failed')
    return data
  },
  postImage: async (file) => {
    const formData = new FormData()
    formData.append('image', file)
    const token = getToken()
    const response = await fetch(`${API_URL}/upload/post-image`, {
      method: 'POST',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Upload failed')
    return data
  },
}
