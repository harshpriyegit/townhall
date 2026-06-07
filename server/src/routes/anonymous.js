import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/anonymous - Get all anonymous posts
router.get('/', async (req, res) => {
  try {
    const posts = await prisma.anonymousPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        anonTag: true,
        reactions: true,
        createdAt: true,
      },
    });

    return res.json({ posts });
  } catch (err) {
    console.error('Get anonymous posts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/anonymous - Create anonymous post
router.post('/', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    // Generate random anonymous tag
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let tag = '#';
    for (let i = 0; i < 4; i++) {
      tag += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const post = await prisma.anonymousPost.create({
      data: {
        content: content.trim(),
        authorId: req.user.id,
        anonTag: tag,
        reactions: { thumbsUp: 0, thumbsDown: 0, laugh: 0, wow: 0 },
      },
      select: {
        id: true,
        content: true,
        anonTag: true,
        reactions: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ post });
  } catch (err) {
    console.error('Create anonymous post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/anonymous/:id/react - Toggle reaction
router.post('/:id/react', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    const validTypes = ['thumbsUp', 'thumbsDown', 'laugh', 'wow'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid reaction type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const post = await prisma.anonymousPost.findUnique({ where: { id } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const reactions = typeof post.reactions === 'string'
      ? JSON.parse(post.reactions)
      : post.reactions || { thumbsUp: 0, thumbsDown: 0, laugh: 0, wow: 0 };

    reactions[type] = (reactions[type] || 0) + 1;

    const updatedPost = await prisma.anonymousPost.update({
      where: { id },
      data: { reactions },
      select: {
        id: true,
        content: true,
        anonTag: true,
        reactions: true,
        createdAt: true,
      },
    });

    return res.json({ post: updatedPost });
  } catch (err) {
    console.error('React to anonymous post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
