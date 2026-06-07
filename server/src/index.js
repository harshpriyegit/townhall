import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { setupSocket } from './socket/index.js';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import anonymousRoutes from './routes/anonymous.js';
import datingRoutes from './routes/dating.js';
import cuffingRoutes from './routes/cuffing.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Setup Socket.IO
const io = setupSocket(server);

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TownHall API',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/anonymous', anonymousRoutes);
app.use('/api/dating', datingRoutes);
app.use('/api/cuffing', cuffingRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🏛️  TownHall API running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  console.log(`🔌 Socket.IO ready for real-time connections`);
});

export default app;
