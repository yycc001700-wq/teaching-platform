const TOTAL_QUESTIONS = 15;
const QUESTION_TIME = 15; // 秒

function generateQuestion() {
  const divisor = Math.floor(Math.random() * 8) + 2;
  const is3digit = Math.random() > 0.4;
  const dividend = is3digit
    ? Math.floor(Math.random() * 900) + 100
    : Math.floor(Math.random() * 81) + 12;
  return {
    dividend,
    divisor,
    quotient: Math.floor(dividend / divisor),
    remainder: dividend % divisor
  };
}

function calcScore(elapsedMs, isCorrect) {
  if (!isCorrect) return -20;
  const sec = elapsedMs / 1000;
  let base = 40;
  if (sec <= 3) base = 100;
  else if (sec <= 6) base = 80;
  else if (sec <= 10) base = 60;

  // >5秒答對，20%機率幸運雙倍
  const lucky = sec > 5 && Math.random() < 0.2;
  return { points: lucky ? base * 2 : base, lucky };
}

module.exports = {
  init(io, db) {
    const rooms = {};

    function generateRoomCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      return code;
    }

    function getRoomByCode(code) {
      return Object.values(rooms).find(r => r.code === code);
    }

    function broadcastLeaderboard(room) {
      const leaderboard = Object.values(room.players)
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, correct: p.correct, wrong: p.wrong }));
      io.to(room.code).emit('leaderboard', leaderboard);
    }

    function saveScores(room) {
      const sessionId = room.sessionId;
      if (!sessionId) return;
      db.endSession(sessionId);
      for (const p of Object.values(room.players)) {
        db.saveStudentScore(sessionId, p.name, Math.max(0, p.score), p.correct, p.wrong, p.answers);
      }
    }

    function nextQuestion(room) {
      if (room.questionTimer) clearTimeout(room.questionTimer);

      if (room.questionIndex >= TOTAL_QUESTIONS) {
        // 遊戲結束
        room.status = 'ended';
        saveScores(room);
        const finalBoard = Object.values(room.players)
          .sort((a, b) => b.score - a.score)
          .map((p, i) => ({ rank: i + 1, name: p.name, score: Math.max(0, p.score), correct: p.correct, wrong: p.wrong }));
        io.to(room.code).emit('gameEnd', { leaderboard: finalBoard });
        return;
      }

      const q = generateQuestion();
      room.currentQuestion = q;
      room.questionStart = Date.now();
      room.questionIndex++;
      room.answered = {};

      // 標記所有玩家為未答
      for (const pid of Object.keys(room.players)) {
        room.answered[pid] = false;
      }

      io.to(room.code).emit('question', {
        index: room.questionIndex,
        total: TOTAL_QUESTIONS,
        dividend: q.dividend,
        divisor: q.divisor
      });

      // 15秒後自動進下一題
      room.questionTimer = setTimeout(() => {
        // 未答的人記錄
        for (const [pid, ans] of Object.entries(room.answered)) {
          if (ans === false && room.players[pid]) {
            room.players[pid].answers.push({ q: `${q.dividend}÷${q.divisor}`, correct: false, timeout: true });
          }
        }
        broadcastLeaderboard(room);
        io.to(room.code).emit('questionTimeout', {
          answer: { quotient: q.quotient, remainder: q.remainder }
        });
        setTimeout(() => nextQuestion(room), 2000);
      }, QUESTION_TIME * 1000);
    }

    const nsp = io.of('/division');

    nsp.on('connection', (socket) => {
      // 老師建立房間
      socket.on('createRoom', ({ teacherId, gameType }, callback) => {
        let code = generateRoomCode();
        while (getRoomByCode(code)) code = generateRoomCode();

        // 記錄到資料庫
        const session = db.createSession(teacherId, gameType || 'division', code);
        const sessionId = session.id;

        rooms[socket.id] = {
          code,
          sessionId,
          teacherSocketId: socket.id,
          teacherId,
          players: {},
          status: 'waiting',
          questionIndex: 0,
          currentQuestion: null,
          questionStart: null,
          answered: {},
          questionTimer: null
        };

        socket.join(code);
        if (callback) callback({ code, sessionId });
        console.log(`[division] 老師建立房間 ${code}`);
      });

      // 老師監控：重新取得房間
      socket.on('rejoinRoom', ({ code }, callback) => {
        const room = getRoomByCode(code);
        if (!room) return callback && callback({ error: '找不到房間' });
        socket.join(code);
        if (callback) callback({ ok: true });
      });

      // 學生加入
      socket.on('joinRoom', ({ code, name }, callback) => {
        const room = getRoomByCode(code);
        if (!room) return callback && callback({ error: '找不到房間代碼' });
        if (room.status !== 'waiting') return callback && callback({ error: '遊戲已開始，無法加入' });
        if (Object.keys(room.players).length >= 15) return callback && callback({ error: '房間已滿（最多15人）' });

        // 名字重複處理
        const names = Object.values(room.players).map(p => p.name);
        if (names.includes(name)) return callback && callback({ error: '名字重複，請換一個' });

        room.players[socket.id] = {
          id: socket.id,
          name,
          score: 0,
          correct: 0,
          wrong: 0,
          answers: []
        };

        socket.join(code);
        socket.roomCode = code;

        // 通知老師有人加入
        const playerList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
        nsp.to(room.code).emit('playerJoined', { players: playerList });

        if (callback) callback({ ok: true, roomCode: code });
        console.log(`[division] 學生 ${name} 加入房間 ${code}`);
      });

      // 老師開始遊戲
      socket.on('startGame', ({ code }) => {
        const room = rooms[socket.id] || getRoomByCode(code);
        if (!room) return;
        if (room.status !== 'waiting') return;
        if (Object.keys(room.players).length === 0) return;

        room.status = 'playing';
        room.questionIndex = 0;

        io.of('/division').to(room.code).emit('gameStarting', { total: TOTAL_QUESTIONS });
        setTimeout(() => nextQuestion(room), 3000);
      });

      // 學生提交答案
      socket.on('submitAnswer', ({ quotient, remainder }) => {
        const code = socket.roomCode;
        if (!code) return;
        const room = getRoomByCode(code);
        if (!room || room.status !== 'playing') return;
        if (!room.players[socket.id]) return;
        if (room.answered[socket.id] !== false) return; // 已答過

        const q = room.currentQuestion;
        if (!q) return;

        const elapsed = Date.now() - room.questionStart;
        const isCorrect = parseInt(quotient) === q.quotient && parseInt(remainder) === q.remainder;

        room.answered[socket.id] = true;

        const player = room.players[socket.id];
        let pointsGained = 0;
        let lucky = false;

        if (isCorrect) {
          const result = calcScore(elapsed, true);
          pointsGained = result.points;
          lucky = result.lucky;
          player.correct++;
        } else {
          pointsGained = -20;
          player.wrong++;
        }

        player.score = Math.max(0, player.score + pointsGained);
        player.answers.push({
          q: `${q.dividend}÷${q.divisor}`,
          correct: isCorrect,
          points: pointsGained,
          lucky
        });

        socket.emit('answerResult', {
          correct: isCorrect,
          points: pointsGained,
          score: player.score,
          lucky,
          answer: { quotient: q.quotient, remainder: q.remainder }
        });

        // 通知老師誰答對/答錯
        const teacherSocket = nsp.sockets.get(room.teacherSocketId);
        if (teacherSocket) {
          teacherSocket.emit('studentAnswered', {
            name: player.name,
            correct: isCorrect,
            score: player.score
          });
        }

        broadcastLeaderboard(room);

        // 檢查是否全部答完
        const allAnswered = Object.values(room.answered).every(v => v === true);
        if (allAnswered) {
          if (room.questionTimer) clearTimeout(room.questionTimer);
          io.of('/division').to(room.code).emit('allAnswered', {
            answer: { quotient: q.quotient, remainder: q.remainder }
          });
          setTimeout(() => nextQuestion(room), 2000);
        }
      });

      // 斷線處理
      socket.on('disconnect', () => {
        // 老師斷線
        if (rooms[socket.id]) {
          const room = rooms[socket.id];
          if (room.questionTimer) clearTimeout(room.questionTimer);
          // 不立即刪除，讓學生頁面保持連線
          return;
        }
        // 學生斷線
        const code = socket.roomCode;
        if (code) {
          const room = getRoomByCode(code);
          if (room && room.players[socket.id]) {
            const name = room.players[socket.id].name;
            delete room.players[socket.id];
            const playerList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
            nsp.to(code).emit('playerLeft', { name, players: playerList });
          }
        }
      });
    });

    console.log('[division] 除法對戰遊戲模組已載入');
  }
};
