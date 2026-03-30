# 🎓 教學遊戲平台

國小教學遊戲平台，支援多位老師帳號、學生成績記錄、即時遊戲對戰。

## 快速開始

```bash
npm install
npm start
```

預設開啟 http://localhost:3000

## 預設帳號

- 帳號：`admin`
- 密碼：`admin123`

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `PORT` | 伺服器埠號 | `3000` |
| `JWT_SECRET` | JWT 密鑰 | `teaching-platform-secret-2024` |
| `DB_PATH` | SQLite 資料庫路徑 | `db/teaching.db` |

## 架構

- 後端：Node.js + Express + Socket.io
- 資料庫：SQLite（better-sqlite3）
- 前端：HTML + CSS + Vanilla JS
- 認證：JWT + bcrypt

## 遊戲模組

- `games/division/` — 除法對戰（2~3位數 ÷ 2~9）

## 新增遊戲

在 `games/` 下新增資料夾，建立 `game.js`：

```js
module.exports = {
  init(io, db) {
    // 在此實作遊戲邏輯
  }
}
```

伺服器啟動時會自動載入。
