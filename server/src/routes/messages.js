import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/messages/conversations - Get conversation list
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all unique conversation partners
    const sentMessages = await prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    // Merge unique partner IDs
    const partnerIds = [
      ...new Set([
        ...sentMessages.map((m) => m.receiverId),
        ...receivedMessages.map((m) => m.senderId),
      ]),
    ];

    // For each partner, get last message and partner info
    const conversations = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const [partner, lastMessage, unreadCount] = await Promise.all([
          prisma.user.findUnique({
            where: { id: partnerId },
            select: {
              id: true,
              fullName: true,
              username: true,
              avatar: true,
            },
          }),
          prisma.message.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: partnerId },
                { senderId: partnerId, receiverId: userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.message.count({
            where: {
              senderId: partnerId,
              receiverId: userId,
              read: false,
            },
          }),
        ]);

        return {
          partner,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message time (most recent first)
    conversations.sort(
      (a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0)
    );

    return res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/:userId - Get messages with a specific user
router.get('/:userId', async (req, res) => {
  try {
    const { userId: partnerId } = req.params;
    const userId = req.user.id;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Mark unread messages from partner as read
    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        read: false,
      },
      data: { read: true },
    });

    return res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/:userId - Send message to user
router.post('/:userId', async (req, res) => {
  try {
    const { userId: receiverId } = req.params;
    const senderId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId,
        receiverId,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/messages/:messageId/read - Mark message as read
router.put('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'You can only mark your own received messages as read' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { read: true },
    });

    return res.json({ message: updatedMessage });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
