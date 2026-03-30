const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

module.exports = (db) => {
  // GET /api/games/sessions - 取得老師的歷史房間
  router.get('/sessions', authMiddleware, (req, res) => {
    const sessions = db.getSessionsByTeacher(req.teacher.id);
    // 附上每場的學生人數
    const sessionsWithCount = sessions.map(s => {
      const scores = db.getScoresBySession(s.id);
      return { ...s, student_count: scores.length };
    });
    res.json(sessionsWithCount);
  });

  // GET /api/games/sessions/:id - 取得特定房間的成績詳情
  router.get('/sessions/:id', authMiddleware, (req, res) => {
    const sessionId = parseInt(req.params.id);
    const session = db.getSessionById(sessionId);
    if (!session || session.teacher_id !== req.teacher.id) {
      return res.status(404).json({ error: '找不到此場次' });
    }
    const scores = db.getScoresBySession(sessionId);
    const scoresWithAnswers = scores
      .map(s => ({ ...s, answers: s.answers ? JSON.parse(s.answers) : [] }))
      .sort((a, b) => b.score - a.score);

    res.json({ session, scores: scoresWithAnswers });
  });

  return router;
};
