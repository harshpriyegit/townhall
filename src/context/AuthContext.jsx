import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../utils/api'
import { connectSocket, disconnectSocket } from '../utils/socket'

const AuthContext = createContext(null)

const TOKEN_KEY = 'townhall_token'
const USER_KEY = 'townhall_user'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!currentUser

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }

    authAPI.me()
      .then((data) => {
        const user = data.user || data
        localStorage.setItem(USER_KEY, JSON.stringify(user))
        connectSocket(user._id || user.id)
        setCurrentUser(user)
      })
      .catch(() => {
        // Token invalid — clear everything
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setCurrentUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await authAPI.login({ email, password })
    const token = data.token
    const user = data.user || data

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
    connectSocket(user._id || user.id)
    return user
  }, [])

  const signup = useCallback(async ({ fullName, email, username, password, collegeSlug }) => {
    const data = await authAPI.signup({ fullName, email, username, password, collegeSlug })
    const token = data.token
    const user = data.user || data

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
    connectSocket(user._id || user.id)
    return user
  }, [])

  const logout = useCallback(() => {
    disconnectSocket()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('townhall_posts')
    setCurrentUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem(USER_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Show nothing while verifying token on first load
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #F0F0F0',
          borderTopColor: '#2D2D2D',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
