import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'))
    }
  }
})

// POST /api/upload/avatar - Upload profile photo
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const avatarUrl = `/uploads/${req.file.filename}`

    // Update user's avatar in database
    const { default: prisma } = await import('../lib/prisma.js')
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl }
    })

    res.json({ avatarUrl })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/upload/post-image - Upload image for a post
router.post('/post-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const imageUrl = `/uploads/${req.file.filename}`
    res.json({ imageUrl })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Configure multer for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `video-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska']
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only videos are allowed'))
    }
  }
})

// POST /api/upload/post-video - Upload 10-second video for a post
router.post('/post-video', authenticateToken, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const videoUrl = `/uploads/${req.file.filename}`
    res.json({ videoUrl })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

