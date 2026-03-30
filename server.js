const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// 初始化資料庫
const db = require('./db/database');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/games', require('./routes/game')(db));

// 健康檢查
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 自動載入 games/ 下所有遊戲模組
const gamesDir = path.join(__dirname, 'games');
fs.readdirSync(gamesDir).forEach(gameFolder => {
  const gamePath = path.join(gamesDir, gameFolder, 'game.js');
  if (fs.existsSync(gamePath)) {
    const gameModule = require(gamePath);
    gameModule.init(io, db);
    console.log(`載入遊戲模組: ${gameFolder}`);
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`教學遊戲平台啟動：http://0.0.0.0:${PORT}`);
});
