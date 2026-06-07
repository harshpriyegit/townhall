import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/posts - Get all posts (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatar: true,
            },
          },
          likes: {
            select: { userId: true },
          },
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
      prisma.post.count(),
    ]);

    const postsWithMeta = posts.map((post) => {
      const { likes, _count, ...postData } = post;
      return {
        ...postData,
        likesCount: _count.likes,
        commentsCount: _count.comments,
        isLiked: likes.some((like) => like.userId === req.user.id),
      };
    });

    return res.json({
      posts: postsWithMeta,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get posts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/posts - Create a post
router.post('/', async (req, res) => {
  try {
    const { content, imageUrl, videoUrl } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    const { _count, ...postData } = post;

    return res.status(201).json({
      ...postData,
      likesCount: _count.likes,
      commentsCount: _count.comments,
      isLiked: false,
    });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/posts/:id - Delete own post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await prisma.post.delete({ where: { id } });

    return res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/posts/:id/like - Toggle like on post
router.post('/:id/like', async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingLike = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({ where: { id: existingLike.id } });
      const likesCount = await prisma.like.count({ where: { postId } });
      return res.json({ liked: false, likesCount });
    } else {
      // Like
      await prisma.like.create({ data: { postId, userId } });
      const likesCount = await prisma.like.count({ where: { postId } });

      // Create notification for post author (if not self)
      if (post.authorId !== userId) {
        const liker = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        await prisma.notification.create({
          data: {
            type: 'like',
            content: `${liker.username} liked your post`,
            receiverId: post.authorId,
            senderId: userId,
          },
        });
      }

      return res.json({ liked: true, likesCount });
    }
  } catch (err) {
    console.error('Toggle like error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/posts/:id/comments - Get comments for a post
router.get('/:id/comments', async (req, res) => {
  try {
    const { id: postId } = req.params;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/posts/:id/comments - Add comment to a post
router.post('/:id/comments', async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Create notification for post author (if not self)
    if (post.authorId !== req.user.id) {
      const commenter = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { username: true },
      });
      await prisma.notification.create({
        data: {
          type: 'comment',
          content: `${commenter.username} commented on your post`,
          receiverId: post.authorId,
          senderId: req.user.id,
        },
      });
    }

    return res.status(201).json({ comment });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
