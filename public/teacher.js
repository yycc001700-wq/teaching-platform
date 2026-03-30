// 老師後台邏輯
const token = localStorage.getItem('teacher_token');
const teacherInfo = JSON.parse(localStorage.getItem('teacher_info') || '{}');

if (!token) { window.location.href = 'login.html'; }

// 顯示老師名稱
document.getElementById('teacherName').textContent = teacherInfo.name || '老師';

let socket = null;
let currentRoom = null;
let currentGameType = 'division';

function logout() {
  localStorage.removeItem('teacher_token');
  localStorage.removeItem('teacher_info');
  window.location.href = 'login.html';
}

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.style.color = 'rgba(255,255,255,0.6)';
    b.classList.remove('active');
  });
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  btn.style.color = 'white';
  if (tab === 'history') loadHistory();
}

// ─── 建立房間 ────────────────────────────────
function createRoom() {
  currentGameType = document.getElementById('gameSelect').value;
  connectSocket(currentGameType, () => {
    socket.emit('createRoom', {
      teacherId: teacherInfo.id,
      gameType: currentGameType
    }, (data) => {
      if (data.error) { alert(data.error); return; }
      currentRoom = data.code;
      showWaiting(data.code);
    });
  });
}

function connectSocket(gameType, cb) {
  if (socket && socket.connected) { cb(); return; }
  socket = io('/' + gameType);
  socket.on('connect', cb);
  socket.on('playerJoined', onPlayerJoined);
  socket.on('studentAnswered', onStudentAnswered);
  socket.on('question', onQuestion);
  socket.on('gameEnd', onGameEnd);
  socket.on('leaderboard', () => {}); // 老師不需要排行榜更新
  socket.on('gameStarting', () => {
    showGameCard();
  });
}

function showWaiting(code) {
  document.getElementById('setupCard').style.display = 'none';
  document.getElementById('waitingCard').style.display = 'block';
  document.getElementById('roomCodeDisplay').textContent = code;
}

function showGameCard() {
  document.getElementById('waitingCard').style.display = 'none';
  document.getElementById('gameCard').style.display = 'block';
}

// ─── 玩家加入 ────────────────────────────────
function onPlayerJoined({ players }) {
  const grid = document.getElementById('waitingPlayerGrid');
  const empty = document.getElementById('waitingPlayerEmpty');
  const countBadge = document.getElementById('playerCountBadge');
  const startBtn = document.getElementById('startBtn');

  countBadge.textContent = `${players.length} / 15 人`;
  grid.innerHTML = '';

  if (players.length > 0) {
    empty.style.display = 'none';
    players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.textContent = p.name;
      chip.id = 'player-' + p.id;
      grid.appendChild(chip);
    });
    startBtn.disabled = false;
  } else {
    empty.style.display = 'block';
    startBtn.disabled = true;
  }

  // 同步到遊戲中的格子
  const gameGrid = document.getElementById('gamePlayerGrid');
  gameGrid.innerHTML = '';
  players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'player-chip waiting';
    chip.textContent = '⏳ ' + p.name;
    chip.id = 'game-player-' + p.id;
    gameGrid.appendChild(chip);
  });
}

// ─── 開始遊戲 ────────────────────────────────
function startGame() {
  if (!socket || !currentRoom) return;
  socket.emit('startGame', { code: currentRoom });
}

function cancelRoom() {
  if (socket) { socket.disconnect(); socket = null; }
  currentRoom = null;
  document.getElementById('setupCard').style.display = 'block';
  document.getElementById('waitingCard').style.display = 'none';
  document.getElementById('waitingPlayerGrid').innerHTML = '';
  document.getElementById('waitingPlayerEmpty').style.display = 'block';
  document.getElementById('startBtn').disabled = true;
}

// ─── 題目推送 ────────────────────────────────
function onQuestion({ index, total, dividend, divisor }) {
  document.getElementById('questionProgress').textContent = `第 ${index} / ${total} 題`;
  document.getElementById('teacherQuestion').textContent = `${dividend} ÷ ${divisor} = ?`;

  // 重設所有玩家狀態
  document.querySelectorAll('#gamePlayerGrid .player-chip').forEach(chip => {
    chip.className = 'player-chip waiting';
    // 移除 ✅/❌ 前綴
    chip.textContent = '⏳ ' + chip.textContent.replace(/^[✅❌⏳] /, '');
  });
}

// ─── 學生答題 ────────────────────────────────
function onStudentAnswered({ name, correct, score }) {
  // 找到對應的卡片（用名字）
  document.querySelectorAll('#gamePlayerGrid .player-chip').forEach(chip => {
    const chipName = chip.textContent.replace(/^[✅❌⏳] /, '');
    if (chipName === name) {
      chip.className = 'player-chip ' + (correct ? 'correct' : 'wrong');
      chip.textContent = (correct ? '✅' : '❌') + ' ' + name;
    }
  });
}

// ─── 遊戲結束 ────────────────────────────────
function onGameEnd({ leaderboard }) {
  document.getElementById('gameCard').style.display = 'none';
  document.getElementById('endCard').style.display = 'block';

  const medals = ['🥇', '🥈', '🥉'];
  const list = document.getElementById('finalLeaderboard');
  list.innerHTML = '';
  leaderboard.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank-badge">${medals[i] || (i + 1)}</span>
      <span class="player-name">${p.name}</span>
      <span style="color:#64748b;margin-right:16px;font-size:0.9rem;">✅${p.correct} ❌${p.wrong}</span>
      <span class="player-score">${p.score} 分</span>
    `;
    list.appendChild(li);
  });
}

function resetGame() {
  if (socket) { socket.disconnect(); socket = null; }
  currentRoom = null;
  document.getElementById('endCard').style.display = 'none';
  document.getElementById('setupCard').style.display = 'block';
  document.getElementById('gamePlayerGrid').innerHTML = '';
  document.getElementById('finalLeaderboard').innerHTML = '';
}

// ─── 歷史成績 ────────────────────────────────
async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<p class="text-gray text-center">載入中...</p>';
  try {
    const res = await fetch('/api/games/sessions', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) { list.innerHTML = '<p class="text-gray text-center">載入失敗</p>'; return; }
    const sessions = await res.json();
    if (!sessions.length) {
      list.innerHTML = '<p class="text-gray text-center">尚無歷史紀錄</p>';
      return;
    }
    list.innerHTML = '';
    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const gameNames = { division: '➗ 除法對戰' };
      const gameName = gameNames[s.game_type] || s.game_type;
      const date = new Date(s.started_at).toLocaleString('zh-TW');
      item.innerHTML = `
        <div>
          <div style="font-weight:bold;">${gameName}</div>
          <div class="text-gray text-sm">${date}</div>
        </div>
        <div style="text-align:right;">
          <div class="badge badge-blue">${s.student_count || 0} 位學生</div>
          <div class="text-gray text-sm mt-8">代碼：${s.room_code}</div>
        </div>
      `;
      item.onclick = () => loadHistoryDetail(s.id);
      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<p class="text-gray text-center">網路錯誤</p>';
  }
}

async function loadHistoryDetail(sessionId) {
  document.getElementById('historyDetail').style.display = 'block';
  document.getElementById('historyDetailContent').innerHTML = '<p class="text-gray text-center">載入中...</p>';
  try {
    const res = await fetch(`/api/games/sessions/${sessionId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const medals = ['🥇', '🥈', '🥉'];
    let html = `<p class="text-gray mb-16">房間代碼：${data.session.room_code}　開始時間：${new Date(data.session.started_at).toLocaleString('zh-TW')}</p>`;
    html += '<ol class="leaderboard">';
    data.scores.forEach((s, i) => {
      html += `<li>
        <span class="rank-badge">${medals[i] || (i + 1)}</span>
        <span class="player-name">${s.student_name}</span>
        <span style="color:#64748b;margin-right:16px;font-size:0.9rem;">✅${s.correct_count} ❌${s.wrong_count}</span>
        <span class="player-score">${s.score} 分</span>
      </li>`;
    });
    html += '</ol>';
    document.getElementById('historyDetailContent').innerHTML = html;
  } catch {
    document.getElementById('historyDetailContent').innerHTML = '<p class="text-gray text-center">載入失敗</p>';
  }
}

function closeHistoryDetail() {
  document.getElementById('historyDetail').style.display = 'none';
}
