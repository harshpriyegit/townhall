import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/cuffing/events - Get all events for user's college
router.get('/events', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { collegeId: true },
    });

    const events = await prisma.event.findMany({
      where: { collegeId: user.collegeId },
      orderBy: { date: 'asc' },
      include: {
        _count: {
          select: { rsvps: true },
        },
        rsvps: {
          where: { userId: req.user.id },
          select: { status: true },
        },
      },
    });

    const eventsWithMeta = events.map((event) => {
      const { rsvps, _count, ...eventData } = event;
      return {
        ...eventData,
        goingCount: _count.rsvps,
        myRsvpStatus: rsvps.length > 0 ? rsvps[0].status : null,
      };
    });

    return res.json({ events: eventsWithMeta });
  } catch (err) {
    console.error('Get events error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cuffing/events/:id/rsvp - Toggle RSVP
router.post('/events/:id/rsvp', async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    if (!status || !['going', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "going" or "not_going"' });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existingRsvp = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    let rsvp;
    if (existingRsvp) {
      if (existingRsvp.status === status) {
        // Remove RSVP (toggle off)
        await prisma.eventRSVP.delete({ where: { id: existingRsvp.id } });
        return res.json({ rsvp: null, message: 'RSVP removed' });
      }
      // Update RSVP status
      rsvp = await prisma.eventRSVP.update({
        where: { id: existingRsvp.id },
        data: { status },
      });
    } else {
      rsvp = await prisma.eventRSVP.create({
        data: { eventId, userId, status },
      });
    }

    return res.json({ rsvp });
  } catch (err) {
    console.error('RSVP error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cuffing/events/:id/participants - Get participants going
router.get('/events/:id/participants', async (req, res) => {
  try {
    const { id: eventId } = req.params;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const rsvps = await prisma.eventRSVP.findMany({
      where: { eventId, status: 'going' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.json({
      participants: rsvps.map((r) => r.user),
    });
  } catch (err) {
    console.error('Get participants error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cuffing/events/:id/cuff - Send cuff request
router.post('/events/:id/cuff', async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const senderId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'receiverId is required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'You cannot send a cuff request to yourself' });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if already sent
    const existing = await prisma.cuffRequest.findUnique({
      where: {
        eventId_senderId_receiverId: { eventId, senderId, receiverId },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Cuff request already sent for this event' });
    }

    const cuffRequest = await prisma.cuffRequest.create({
      data: { eventId, senderId, receiverId },
      include: {
        sender: {
          select: { id: true, fullName: true, username: true, avatar: true },
        },
        receiver: {
          select: { id: true, fullName: true, username: true, avatar: true },
        },
        event: {
          select: { id: true, name: true },
        },
      },
    });

    // Notification
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { username: true },
    });
    await prisma.notification.create({
      data: {
        type: 'cuff',
        content: `${sender.username} wants to go to ${event.name} with you! 💕`,
        receiverId,
        senderId,
      },
    });

    return res.status(201).json({ cuffRequest });
  } catch (err) {
    console.error('Send cuff request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cuffing/requests - Get my cuff requests
router.get('/requests', async (req, res) => {
  try {
    const userId = req.user.id;

    const [sent, received] = await Promise.all([
      prisma.cuffRequest.findMany({
        where: { senderId: userId },
        include: {
          receiver: {
            select: { id: true, fullName: true, username: true, avatar: true },
          },
          event: {
            select: { id: true, name: true, date: true, venue: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cuffRequest.findMany({
        where: { receiverId: userId },
        include: {
          sender: {
            select: { id: true, fullName: true, username: true, avatar: true },
          },
          event: {
            select: { id: true, name: true, date: true, venue: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({ sent, received });
  } catch (err) {
    console.error('Get cuff requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/cuffing/requests/:id - Update cuff request status
router.put('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "accepted" or "declined"' });
    }

    const cuffRequest = await prisma.cuffRequest.findUnique({
      where: { id },
      include: {
        event: { select: { name: true } },
      },
    });

    if (!cuffRequest) {
      return res.status(404).json({ error: 'Cuff request not found' });
    }

    if (cuffRequest.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Only the receiver can update this request' });
    }

    if (cuffRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been responded to' });
    }

    const updated = await prisma.cuffRequest.update({
      where: { id },
      data: { status },
      include: {
        sender: {
          select: { id: true, fullName: true, username: true, avatar: true },
        },
        receiver: {
          select: { id: true, fullName: true, username: true, avatar: true },
        },
        event: {
          select: { id: true, name: true, date: true, venue: true },
        },
      },
    });

    // Notify sender
    const receiver = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    const emoji = status === 'accepted' ? '🎉' : '😔';
    await prisma.notification.create({
      data: {
        type: 'cuff',
        content: `${receiver.username} ${status} your cuff request for ${cuffRequest.event.name} ${emoji}`,
        receiverId: cuffRequest.senderId,
        senderId: req.user.id,
      },
    });

    return res.json({ cuffRequest: updated });
  } catch (err) {
    console.error('Update cuff request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
