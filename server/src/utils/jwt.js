import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    ACCESS_SECRET,
    { expiresIn: '24h' }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}
