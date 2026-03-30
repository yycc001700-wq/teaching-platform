const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');

// 初始化資料結構
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { teachers: [], game_sessions: [], student_scores: [], _nextId: { teachers: 1, sessions: 1, scores: 1 } };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { teachers: [], game_sessions: [], student_scores: [], _nextId: { teachers: 1, sessions: 1, scores: 1 } };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  // 老師相關
  getTeacherByUsername(username) {
    const data = loadDB();
    return data.teachers.find(t => t.username === username) || null;
  },
  getTeacherById(id) {
    const data = loadDB();
    return data.teachers.find(t => t.id === id) || null;
  },
  createTeacher(username, password, name) {
    const data = loadDB();
    if (data.teachers.find(t => t.username === username)) return null;
    const teacher = {
      id: data._nextId.teachers++,
      username,
      password,
      name,
      created_at: new Date().toISOString()
    };
    data.teachers.push(teacher);
    saveDB(data);
    return teacher;
  },

  // 遊戲房間
  createSession(teacherId, gameType, roomCode) {
    const data = loadDB();
    const session = {
      id: data._nextId.sessions++,
      teacher_id: teacherId,
      game_type: gameType,
      room_code: roomCode,
      started_at: new Date().toISOString(),
      ended_at: null,
      total_questions: 15
    };
    data.game_sessions.push(session);
    saveDB(data);
    return session;
  },
  endSession(sessionId) {
    const data = loadDB();
    const session = data.game_sessions.find(s => s.id === sessionId);
    if (session) {
      session.ended_at = new Date().toISOString();
      saveDB(data);
    }
  },
  getSessionsByTeacher(teacherId) {
    const data = loadDB();
    return data.game_sessions.filter(s => s.teacher_id === teacherId).reverse();
  },
  getSessionById(sessionId) {
    const data = loadDB();
    return data.game_sessions.find(s => s.id === sessionId) || null;
  },

  // 學生成績
  saveStudentScore(sessionId, studentName, score, correctCount, wrongCount, answers) {
    const data = loadDB();
    const record = {
      id: data._nextId.scores++,
      session_id: sessionId,
      student_name: studentName,
      score,
      correct_count: correctCount,
      wrong_count: wrongCount,
      answers: JSON.stringify(answers),
      created_at: new Date().toISOString()
    };
    data.student_scores.push(record);
    saveDB(data);
    return record;
  },
  getScoresBySession(sessionId) {
    const data = loadDB();
    return data.student_scores.filter(s => s.session_id === sessionId);
  }
};

// 初始化預設管理員帳號
function initDefaultAdmin() {
  const existing = db.getTeacherByUsername('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.createTeacher('admin', hash, '管理員');
    console.log('✅ 預設管理員帳號已建立 (admin / admin123)');
  }
}

initDefaultAdmin();

module.exports = db;
