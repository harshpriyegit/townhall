import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/users/search?q=query - Search users
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { id: req.user.id },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatar: true,
        bio: true,
      },
      take: 20,
    });

    return res.json({ users });
  } catch (err) {
    console.error('Search users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        collegeId: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        college: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { _count, ...userData } = user;
    return res.json({
      user: {
        ...userData,
        postCount: _count.posts,
        followersCount: _count.followers,
        followingCount: _count.following,
      },
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:username - Get user profile by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatar: true,
        bio: true,
        collegeId: true,
        isVerified: true,
        createdAt: true,
        college: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if current user is following this user
    const isFollowing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user.id,
          followingId: user.id,
        },
      },
    });

    const { _count, ...userData } = user;
    return res.json({
      user: {
        ...userData,
        postCount: _count.posts,
        followersCount: _count.followers,
        followingCount: _count.following,
        isFollowing: !!isFollowing,
      },
    });
  } catch (err) {
    console.error('Get user profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/me - Update own profile
router.put('/me', async (req, res) => {
  try {
    const { fullName, bio, avatar } = req.body;

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        collegeId: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        college: true,
      },
    });

    return res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/follow - Toggle follow/unfollow
router.post('/:id/follow', async (req, res) => {
  try {
    const { id: followingId } = req.params;
    const followerId = req.user.id;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      return res.json({ following: false });
    } else {
      // Follow
      await prisma.follow.create({
        data: { followerId, followingId },
      });

      // Notification
      const follower = await prisma.user.findUnique({
        where: { id: followerId },
        select: { username: true },
      });
      await prisma.notification.create({
        data: {
          type: 'follow',
          content: `${follower.username} started following you`,
          receiverId: followingId,
          senderId: followerId,
        },
      });

      return res.json({ following: true });
    }
  } catch (err) {
    console.error('Toggle follow error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/followers - Get user's followers
router.get('/:id/followers', async (req, res) => {
  try {
    const { id } = req.params;

    const followers = await prisma.follow.findMany({
      where: { followingId: id },
      include: {
        follower: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      followers: followers.map((f) => f.follower),
    });
  } catch (err) {
    console.error('Get followers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/following - Get user's following
router.get('/:id/following', async (req, res) => {
  try {
    const { id } = req.params;

    const following = await prisma.follow.findMany({
      where: { followerId: id },
      include: {
        following: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      following: following.map((f) => f.following),
    });
  } catch (err) {
    console.error('Get following error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
