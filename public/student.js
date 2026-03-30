// 學生端邏輯
let socket = null;
let myName = '';
let myRoomCode = '';
let myScore = 0;
let myCorrect = 0;
let myWrong = 0;
let questionStart = null;
let timerInterval = null;
let answered = false;
const QUESTION_TIME = 15;

// ─── 加入遊戲 ────────────────────────────────
document.getElementById('roomCodeInput').addEventListener('input', function() {
  this.value = this.value.toUpperCase();
});

document.getElementById('joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('nameInput').value.trim();
  const alertBox = document.getElementById('joinAlert');

  if (!code || code.length !== 6) {
    alertBox.innerHTML = '<div class="alert alert-error">請輸入6碼房間代碼</div>';
    return;
  }
  if (!name) {
    alertBox.innerHTML = '<div class="alert alert-error">請輸入你的名字</div>';
    return;
  }

  alertBox.innerHTML = '';
  joinGame(code, name);
});

function joinGame(code, name) {
  myName = name;
  myRoomCode = code;

  socket = io('/division');

  socket.on('connect', () => {
    socket.emit('joinRoom', { code, name }, (res) => {
      if (res && res.error) {
        document.getElementById('joinAlert').innerHTML = `<div class="alert alert-error">${res.error}</div>`;
        socket.disconnect();
        socket = null;
        return;
      }
      // 進入等待頁
      document.getElementById('joinCard').style.display = 'none';
      document.getElementById('waitCard').style.display = 'block';
      document.getElementById('myRoomCode').textContent = code;
      document.getElementById('myName').textContent = name;
      document.getElementById('navStatus').textContent = name;
    });
  });

  socket.on('disconnect', () => {
    document.getElementById('navStatus').textContent = '已斷線';
  });

  socket.on('gameStarting', ({ total }) => {
    showCountdown(total);
  });

  socket.on('question', onQuestion);
  socket.on('answerResult', onAnswerResult);
  socket.on('leaderboard', updateLeaderboard);
  socket.on('questionTimeout', onQuestionTimeout);
  socket.on('allAnswered', onAllAnswered);
  socket.on('gameEnd', onGameEnd);
}

// ─── 倒數計時 ────────────────────────────────
function showCountdown(total) {
  document.getElementById('waitCard').style.display = 'none';
  document.getElementById('countdownCard').style.display = 'block';
  let n = 3;
  document.getElementById('countdownNum').textContent = n;
  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      document.getElementById('countdownNum').textContent = n;
    } else {
      clearInterval(iv);
      document.getElementById('countdownCard').style.display = 'none';
      document.getElementById('gameCard').style.display = 'block';
    }
  }, 1000);
}

// ─── 題目 ────────────────────────────────────
function onQuestion({ index, total, dividend, divisor }) {
  answered = false;
  document.getElementById('questionProgressLabel').textContent = `第 ${index} / ${total} 題`;
  document.getElementById('questionText').textContent = `${dividend} ÷ ${divisor} = ?`;

  // 重設答案區域
  document.getElementById('answerArea').style.display = 'block';
  document.getElementById('waitingNextArea').style.display = 'none';
  document.getElementById('quotientInput').value = '';
  document.getElementById('remainderInput').value = '';
  document.getElementById('quotientInput').disabled = false;
  document.getElementById('remainderInput').disabled = false;
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('quotientInput').focus();

  // 啟動計時條
  startTimer(QUESTION_TIME);
}

function startTimer(seconds) {
  if (timerInterval) clearInterval(timerInterval);
  questionStart = Date.now();
  const bar = document.getElementById('timerBar');
  const label = document.getElementById('timerLabel');
  bar.style.width = '100%';
  bar.className = 'timer-bar';
  label.textContent = seconds;

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - questionStart) / 1000;
    const remaining = Math.max(0, seconds - elapsed);
    const pct = (remaining / seconds) * 100;

    bar.style.width = pct + '%';
    label.textContent = Math.ceil(remaining);

    if (remaining <= 5) {
      bar.className = 'timer-bar warning';
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

// ─── 提交答案 ────────────────────────────────
function submitAnswer() {
  if (answered) return;
  const q = parseInt(document.getElementById('quotientInput').value);
  const r = parseInt(document.getElementById('remainderInput').value);
  if (isNaN(q) || isNaN(r)) {
    showToast('請填入商和餘數！', 'wrong');
    return;
  }
  answered = true;
  stopTimer();

  document.getElementById('quotientInput').disabled = true;
  document.getElementById('remainderInput').disabled = true;
  document.getElementById('submitBtn').disabled = true;

  socket.emit('submitAnswer', { quotient: q, remainder: r });
}

// 按 Enter 也可以提交
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !answered) {
    submitAnswer();
  }
});

// ─── 答案結果 ────────────────────────────────
function onAnswerResult({ correct, points, score, lucky, answer }) {
  myScore = score;
  if (correct) {
    myCorrect++;
    if (correct) myWrong > 0 && myWrong--;
  } else {
    myWrong++;
  }

  document.getElementById('myScore').textContent = myScore;

  document.getElementById('answerArea').style.display = 'none';
  document.getElementById('waitingNextArea').style.display = 'block';

  const emoji = document.getElementById('resultEmoji');
  const msg = document.getElementById('resultMsg');

  if (correct) {
    emoji.textContent = lucky ? '⭐' : '✅';
    msg.textContent = `答對了！獲得 ${points} 分`;
    msg.style.color = '#059669';
    if (lucky) {
      showLucky();
    }
  } else {
    emoji.textContent = '❌';
    msg.textContent = `答錯了…正確答案：商 ${answer.quotient}，餘數 ${answer.remainder}`;
    msg.style.color = '#dc2626';
  }

  showToast(correct ? `+${points} 分！` + (lucky ? ' ⭐' : '') : `-20 分`, correct ? 'correct' : 'wrong');
}

function onQuestionTimeout({ answer }) {
  stopTimer();
  document.getElementById('answerArea').style.display = 'none';
  document.getElementById('waitingNextArea').style.display = 'block';
  if (!answered) {
    document.getElementById('resultEmoji').textContent = '⏱️';
    document.getElementById('resultMsg').textContent = `時間到！正確答案：商 ${answer.quotient}，餘數 ${answer.remainder}`;
    document.getElementById('resultMsg').style.color = '#d97706';
  }
}

function onAllAnswered({ answer }) {
  stopTimer();
  if (!answered) {
    document.getElementById('answerArea').style.display = 'none';
    document.getElementById('waitingNextArea').style.display = 'block';
    document.getElementById('resultEmoji').textContent = '⏱️';
    document.getElementById('resultMsg').textContent = `全部作答完畢！商 ${answer.quotient}，餘數 ${answer.remainder}`;
    document.getElementById('resultMsg').style.color = '#64748b';
  }
}

// ─── 排行榜 ──────────────────────────────────
function updateLeaderboard(leaderboard) {
  const medals = ['🥇', '🥈', '🥉'];
  const ul = document.getElementById('liveLeaderboard');
  ul.innerHTML = '';
  leaderboard.forEach((p, i) => {
    const li = document.createElement('li');
    const isMe = p.name === myName;
    if (isMe) li.style.background = '#ede9fe';
    li.innerHTML = `
      <span class="rank-badge">${medals[i] || (i + 1)}</span>
      <span class="player-name">${p.name}${isMe ? ' 👈' : ''}</span>
      <span class="player-score">${p.score} 分</span>
    `;
    ul.appendChild(li);
  });
}

// ─── 遊戲結束 ────────────────────────────────
function onGameEnd({ leaderboard }) {
  stopTimer();
  document.getElementById('gameCard').style.display = 'none';
  document.getElementById('endCard').style.display = 'block';

  // 找到自己的成績
  const me = leaderboard.find(p => p.name === myName) || { score: 0, correct: 0, wrong: 0 };
  document.getElementById('finalScore').textContent = me.score + ' 分';
  document.getElementById('finalStats').textContent = `答對 ${me.correct} 題 ／ 答錯 ${me.wrong} 題`;

  const medals = ['🥇', '🥈', '🥉'];
  const ul = document.getElementById('endLeaderboard');
  ul.innerHTML = '';
  leaderboard.forEach((p, i) => {
    const li = document.createElement('li');
    const isMe = p.name === myName;
    if (isMe) li.style.background = '#ede9fe';
    li.innerHTML = `
      <span class="rank-badge">${medals[i] || (i + 1)}</span>
      <span class="player-name">${p.name}${isMe ? ' 👈' : ''}</span>
      <span style="color:#64748b;margin-right:16px;font-size:0.9rem;">✅${p.correct} ❌${p.wrong}</span>
      <span class="player-score">${p.score} 分</span>
    `;
    ul.appendChild(li);
  });
}

// ─── 幸運特效 ────────────────────────────────
function showLucky() {
  const overlay = document.getElementById('luckyOverlay');
  overlay.style.display = 'flex';

  // 星星爆炸
  for (let i = 0; i < 20; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.textContent = '⭐';
    star.style.left = (30 + Math.random() * 40) + 'vw';
    star.style.top = (30 + Math.random() * 40) + 'vh';
    const dx = (Math.random() - 0.5) * 300;
    const dy = (Math.random() - 0.5) * 300;
    star.style.setProperty('--dx', dx + 'px');
    star.style.setProperty('--dy', dy + 'px');
    star.style.animationDelay = (Math.random() * 0.3) + 's';
    document.body.appendChild(star);
    setTimeout(() => star.remove(), 2000);
  }

  setTimeout(() => { overlay.style.display = 'none'; }, 1800);
}

// ─── Toast 提示 ──────────────────────────────
function showToast(msg, type) {
  const existing = document.querySelector('.result-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `result-toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
