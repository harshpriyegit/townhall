import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

const STORAGE_KEY = 'townhall_user'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const isAuthenticated = !!currentUser

  const login = useCallback((userData) => {
    const user = {
      id: userData.id || '1',
      fullName: userData.fullName || userData.email?.split('@')[0] || 'User',
      email: userData.email,
      username: userData.username || userData.email?.split('@')[0] || 'user',
      avatar: userData.avatar || null,
      college: userData.college || 'vit',
      bio: userData.bio || '',
      followers: userData.followers ?? 42,
      following: userData.following ?? 28,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setCurrentUser(user)
    return user
  }, [])

  const signup = useCallback((userData) => {
    const user = {
      id: '1',
      fullName: userData.fullName,
      email: userData.email,
      username: userData.username,
      avatar: null,
      college: userData.college || 'vit',
      bio: '',
      followers: 42,
      following: 28,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setCurrentUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('townhall_posts')
    setCurrentUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

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
