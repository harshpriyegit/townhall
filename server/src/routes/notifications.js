import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/notifications - Get notifications for current user
router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { receiverId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { receiverId: req.user.id, read: false },
    });

    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { receiverId: req.user.id, read: false },
      data: { read: true },
    });

    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read - Mark single as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json({ notification: updated });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
