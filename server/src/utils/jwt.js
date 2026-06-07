import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET || 'townhall_super_secret_jwt_key_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'townhall_refresh_secret_key_2026';


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
