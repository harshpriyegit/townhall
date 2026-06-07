import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/dating/profile - Get own dating profile
router.get('/profile', async (req, res) => {
  try {
    const profile = await prisma.datingProfile.findUnique({
      where: { userId: req.user.id },
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

    if (!profile) {
      return res.json({ profile: null });
    }

    return res.json({ profile });
  } catch (err) {
    console.error('Get dating profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dating/profile - Create or update dating profile
router.post('/profile', async (req, res) => {
  try {
    const { age, branch, bio, interests, lookingFor } = req.body;

    const data = {
      age: age ? parseInt(age) : null,
      branch: branch || null,
      bio: bio || null,
      interests: interests || [],
      lookingFor: lookingFor || null,
    };

    const existingProfile = await prisma.datingProfile.findUnique({
      where: { userId: req.user.id },
    });

    let profile;
    if (existingProfile) {
      profile = await prisma.datingProfile.update({
        where: { userId: req.user.id },
        data,
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
    } else {
      profile = await prisma.datingProfile.create({
        data: {
          ...data,
          userId: req.user.id,
        },
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
    }

    return res.status(existingProfile ? 200 : 201).json({ profile });
  } catch (err) {
    console.error('Create/update dating profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dating/discover - Get profiles to swipe on
router.get('/discover', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get IDs already swiped on
    const swipedIds = await prisma.datingSwipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true },
    });

    const excludeIds = [userId, ...swipedIds.map((s) => s.swipedId)];

    const profiles = await prisma.datingProfile.findMany({
      where: {
        isActive: true,
        userId: { notIn: excludeIds },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
            college: {
              select: { name: true },
            },
          },
        },
      },
      take: 20,
    });

    return res.json({ profiles });
  } catch (err) {
    console.error('Discover profiles error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dating/swipe - Record swipe
router.post('/swipe', async (req, res) => {
  try {
    const { swipedId, action } = req.body;
    const swiperId = req.user.id;

    if (!swipedId || !action) {
      return res.status(400).json({ error: 'swipedId and action are required' });
    }

    const validActions = ['like', 'pass', 'superlike'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    if (swiperId === swipedId) {
      return res.status(400).json({ error: 'You cannot swipe on yourself' });
    }

    // Check if already swiped
    const existing = await prisma.datingSwipe.findUnique({
      where: { swiperId_swipedId: { swiperId, swipedId } },
    });

    if (existing) {
      return res.status(409).json({ error: 'Already swiped on this user' });
    }

    const swipe = await prisma.datingSwipe.create({
      data: { swiperId, swipedId, action },
    });

    let isMatch = false;

    // Check for mutual like
    if (action === 'like' || action === 'superlike') {
      const mutualSwipe = await prisma.datingSwipe.findFirst({
        where: {
          swiperId: swipedId,
          swipedId: swiperId,
          action: { in: ['like', 'superlike'] },
        },
      });

      if (mutualSwipe) {
        isMatch = true;

        // Notification for both users
        const swiper = await prisma.user.findUnique({
          where: { id: swiperId },
          select: { username: true },
        });
        const swiped = await prisma.user.findUnique({
          where: { id: swipedId },
          select: { username: true },
        });

        await prisma.notification.createMany({
          data: [
            {
              type: 'match',
              content: `You matched with ${swiped.username}! 🎉`,
              receiverId: swiperId,
              senderId: swipedId,
            },
            {
              type: 'match',
              content: `You matched with ${swiper.username}! 🎉`,
              receiverId: swipedId,
              senderId: swiperId,
            },
          ],
        });
      }
    }

    return res.status(201).json({ swipe, isMatch });
  } catch (err) {
    console.error('Swipe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dating/matches - Get mutual matches
router.get('/matches', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all users I liked
    const myLikes = await prisma.datingSwipe.findMany({
      where: {
        swiperId: userId,
        action: { in: ['like', 'superlike'] },
      },
      select: { swipedId: true },
    });

    const myLikedIds = myLikes.map((s) => s.swipedId);

    // Find those who also liked me back
    const mutualMatches = await prisma.datingSwipe.findMany({
      where: {
        swiperId: { in: myLikedIds },
        swipedId: userId,
        action: { in: ['like', 'superlike'] },
      },
      include: {
        swiper: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
            datingProfile: {
              select: {
                bio: true,
                interests: true,
                branch: true,
                age: true,
              },
            },
          },
        },
      },
    });

    const matches = mutualMatches.map((m) => m.swiper);

    return res.json({ matches });
  } catch (err) {
    console.error('Get matches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
