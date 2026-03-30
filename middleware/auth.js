const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'teaching-platform-secret-2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授權，請先登入' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.teacher = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
