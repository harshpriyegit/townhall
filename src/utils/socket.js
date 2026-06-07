import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : (window.location.hostname.includes('onrender.com')
        ? 'https://townhall-i390.onrender.com'
        : window.location.origin
      )
)

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true
    })
  }
  return socket
}

export function connectSocket(userId) {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
    s.emit('user:online', userId)
  }
  return s
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect()
  }
}
