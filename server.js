// 家事小幫手 v2.0 - 後端伺服器
// 資料同步：所有手機共用同一份 chores.json

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, 'chores.json');

// 啟用 CORS，允許 GitHub Pages 和任何網域存取
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 確保資料檔案存在
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ records: [], totalPoints: 0 }, null, 2));
    console.log('✅ 已建立初始資料檔 chores.json');
  }
}

// 讀取資料
function loadData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('讀取資料失敗:', e);
    return { records: [], totalPoints: 0 };
  }
}

// 儲存資料
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('儲存資料失敗:', e);
    return false;
  }
}

// ==================== API 路由 ====================

// 取得所有家事記錄
app.get('/api/chores', (req, res) => {
  const data = loadData();
  res.json({
    success: true,
    records: data.records,
    totalPoints: data.totalPoints
  });
});

// 新增家事記錄
app.post('/api/chores', (req, res) => {
  const { name, chore, points, emoji } = req.body;

  if (!name || !chore || typeof points !== 'number') {
    return res.status(400).json({
      success: false,
      message: '缺少必要欄位：name, chore, points'
    });
  }

  const data = loadData();

  const record = {
    id: Date.now().toString(),
    name: String(name).trim(),
    chore: String(chore).trim(),
    points: Math.max(1, Math.floor(points)),
    emoji: emoji || '✅',
    time: new Date().toLocaleString('zh-TW')
  };

  // 限制最多保留 200 筆（防止檔案過大）
  data.records.unshift(record);
  if (data.records.length > 200) {
    data.records = data.records.slice(0, 200);
  }

  data.totalPoints = data.records.reduce((sum, r) => sum + r.points, 0);

  if (saveData(data)) {
    res.json({ success: true, record, totalPoints: data.totalPoints });
  } else {
    res.status(500).json({ success: false, message: '儲存失敗' });
  }
});

// 刪除家事記錄
app.delete('/api/chores/:id', (req, res) => {
  const { id } = req.params;
  const data = loadData();

  const index = data.records.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '找不到記錄' });
  }

  data.records.splice(index, 1);
  data.totalPoints = data.records.reduce((sum, r) => sum + r.points, 0);

  if (saveData(data)) {
    res.json({ success: true, totalPoints: data.totalPoints });
  } else {
    res.status(500).json({ success: false, message: '刪除失敗' });
  }
});

// 清除所有資料（管理員功能）
app.delete('/api/chores', (req, res) => {
  const { password } = req.body;
  // 簡易密碼保護
  if (password !== 'homemade2025') {
    return res.status(403).json({ success: false, message: '密碼錯誤' });
  }

  const data = { records: [], totalPoints: 0 };
  if (saveData(data)) {
    res.json({ success: true, message: '已清除所有資料' });
  }
});

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 啟動伺服器
initDataFile();

app.listen(PORT, () => {
  console.log(`🏠 家事小幫手 v2.0 伺服器啟動`);
  console.log(`📡 監聽端口: ${PORT}`);
  console.log(`📁 資料檔案: ${DATA_FILE}`);
  console.log(`💡 API 測試: http://localhost:${PORT}/api/health`);
});

module.exports = app;
