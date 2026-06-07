import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Exclude passwordHash from user responses
const userSelectFields = {
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
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email or username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Ensure VIT college exists
    let college = await prisma.college.findUnique({ where: { slug: 'vit' } });
    if (!college) {
      college = await prisma.college.create({
        data: {
          name: 'VIT Vellore',
          slug: 'vit',
          domain: 'vit.ac.in',
          isActive: true,
        },
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        fullName,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        collegeId: college.id,
      },
      select: userSelectFields,
    });

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(201).json({ user, token, refreshToken });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { college: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Remove passwordHash from response
    const { passwordHash, ...userWithoutPassword } = user;

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({ user: userWithoutPassword, token, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: userSelectFields,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: userSelectFields,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return res.json({ token: newAccessToken, refreshToken: newRefreshToken, user });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

export default router;
