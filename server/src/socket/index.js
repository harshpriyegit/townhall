import { Server } from 'socket.io';
import { setupChatSocket } from './chat.js';
import { setupVoiceSocket } from './voice.js';
import { setupVideoSocket } from './video.js';

export function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Track online users: Map<userId, socketId>
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User goes online
    socket.on('user:online', (userId) => {
      onlineUsers.set(userId, socket.id);
      io.emit('user:status', { userId, online: true });
    });

    // Setup handlers
    setupChatSocket(io, socket, onlineUsers);
    setupVoiceSocket(io, socket, onlineUsers);
    setupVideoSocket(io, socket, onlineUsers);

    socket.on('disconnect', () => {
      // Find and remove user
      for (const [userId, sid] of onlineUsers.entries()) {
        if (sid === socket.id) {
          onlineUsers.delete(userId);
          io.emit('user:status', { userId, online: false });
          break;
        }
      }
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}
