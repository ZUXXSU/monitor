import { authAdmin } from './firebase.js';

// Comma-separated allowlist, e.g. "you@buzzit.in". Empty = any authenticated Firebase user.
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  try {
    const decoded = await authAdmin.verifyIdToken(token);
    if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes((decoded.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'email not authorized' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
