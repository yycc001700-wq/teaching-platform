const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

module.exports = (db) => {
  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '請輸入帳號和密碼' });
    }
    const teacher = db.getTeacherByUsername(username);
    if (!teacher) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    const valid = bcrypt.compareSync(password, teacher.password);
    if (!valid) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    const token = jwt.sign(
      { id: teacher.id, username: teacher.username, name: teacher.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, teacher: { id: teacher.id, username: teacher.username, name: teacher.name } });
  });

  // POST /api/auth/register（需要 JWT）
  router.post('/register', authMiddleware, (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: '請填寫完整資料' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const teacher = db.createTeacher(username, hash, name);
    if (!teacher) {
      return res.status(409).json({ error: '帳號已存在' });
    }
    res.json({ id: teacher.id, username, name });
  });

  // GET /api/auth/me（需要 JWT）
  router.get('/me', authMiddleware, (req, res) => {
    const teacher = db.getTeacherById(req.teacher.id);
    if (!teacher) return res.status(404).json({ error: '找不到使用者' });
    res.json({ id: teacher.id, username: teacher.username, name: teacher.name, created_at: teacher.created_at });
  });

  return router;
};
