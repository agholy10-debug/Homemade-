const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Telegram Bot Token - 更新你的 token
const TELEGRAM_BOT_TOKEN = '8635282501:AAHbUZ_G8Y7Y8iZbmjPsuVaA-247kGikDXg';
const TELEGRAM_CHAT_ID = null; // 會自動取得

const DATA_FILE = path.join(__dirname, 'chores_data.json');
const PORT = 8080;

// 載入或初始化資料
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { records: [], totalPoints: 0 };
}

// 保存資料
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 發送 Telegram 通知
async function sendTelegramMessage(text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID || '1934521229', // 默认发送给启动机器人的人
        text: text,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    console.log('Telegram API response:', result);
    return result;
  } catch (e) {
    console.error('Telegram error:', e);
  }
}

// 發送通知並獲取 chat_id
async function sendInitialNotification() {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '1934521229',
        text: '✅ 家事通知機器人啟動成功！\n\n當小孩完成家事時，我會在這裡通知你！👶✨',
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Initial notification error:', e);
  }
}

// 處理靜態文件
function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// 路由處理
function handleRequest(req, res) {
  // CORS 頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 首頁
  if (pathname === '/' || pathname === '/index.html') {
    serveStaticFile(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  // API: 獲取所有記錄
  if (pathname === '/api/records' && req.method === 'GET') {
    const data = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: 提交新家事
  if (pathname === '/api/chores' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { name, chore, points } = JSON.parse(body);
        
        if (!name || !chore || !points) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fields' }));
          return;
        }

        const data = loadData();
        const newRecord = {
          id: crypto.randomUUID(),
          name,
          chore,
          points: parseInt(points),
          emoji: getEmoji(chore),
          time: new Date().toLocaleString('zh-TW'),
          timestamp: Date.now()
        };

        data.records.unshift(newRecord);
        data.totalPoints += parseInt(points);
        saveData(data);

        // 發送 Telegram 通知
        const notifyMsg = `🎉 <b>新家事完成！</b>\n\n👶 小朋友：${name}\n🍳 家事：${chore}\n⭐ 分數：+${points}分\n\n🏆 總累積：${data.totalPoints}分`;
        await sendTelegramMessage(notifyMsg);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, record: newRecord, totalPoints: data.totalPoints }));
      } catch (e) {
        console.error('Parse error:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // API: 刪除記錄
  if (pathname.startsWith('/api/delete/') && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    const data = loadData();
    const index = data.records.findIndex(r => r.id === id);
    
    if (index !== -1) {
      data.totalPoints -= data.records[index].points;
      data.records.splice(index, 1);
      saveData(data);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 靜態資源
  if (pathname.endsWith('.html')) {
    serveStaticFile(res, path.join(__dirname, pathname), 'text/html');
  } else if (pathname.endsWith('.js')) {
    serveStaticFile(res, path.join(__dirname, pathname), 'text/javascript');
  } else if (pathname.endsWith('.css')) {
    serveStaticFile(res, path.join(__dirname, pathname), 'text/css');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}

function getEmoji(chore) {
  const emojis = {
    '洗碗': '🍽️', '掃地': '🧹', '拖地': '💦',
    '疊衣服': '👕', '倒垃圾': '🗑️', '整理房間': '🛏️',
    '澆花': '🌱', '收衣服': '👚', '擦桌子': '🧽'
  };
  return emojis[chore] || '✅';
}

// 啟動伺服器
const server = http.createServer(handleRequest);
server.listen(PORT, async () => {
  console.log(`🚀 家事伺服器已啟動 http://localhost:${PORT}`);
  await sendInitialNotification();
  console.log('✅ Telegram 通知已發送給家長！');
});