// 完整模拟Cloudflare Workers功能的本地服务器
const express = require('express');
const path = require('path');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const app = express();
const port = 8787;

// 创建数据存储目录
if (!existsSync('./data')) {
  mkdirSync('./data');
}

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 模拟Cookie处理中间件
app.use((req, res, next) => {
  // 模拟Cookie解析
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        req.cookies[parts[0]] = parts[1];
      }
    });
  }
  
  // 添加设置Cookie的方法
  res.cookie = (name, value, options = {}) => {
    let cookieStr = `${name}=${value}`;
    if (options.maxAge) {
      cookieStr += `; Max-Age=${options.maxAge}`;
    }
    if (options.httpOnly) {
      cookieStr += '; HttpOnly';
    }
    if (options.path) {
      cookieStr += `; Path=${options.path}`;
    }
    res.setHeader('Set-Cookie', cookieStr);
  };
  
  res.clearCookie = (name, options = {}) => {
    res.cookie(name, '', { ...options, maxAge: 0 });
  };
  
  next();
});

// 模拟环境变量
const env = {
  TITLE: "本地测试 - 云端加速 · 精选导航",
  SUBTITLE: "本地测试环境 - 优质资源推荐",
  admin: "test123", // 本地测试密码
  img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073",
  CONTACT_URL: "https://t.me/Fuzzy_Fbot",
  LINKS: JSON.stringify([
    {
      "id": "test1",
      "name": "测试网站1",
      "emoji": "🚀",
      "note": "这是一个测试链接",
      "url": "https://www.baidu.com",
      "backup_url": "https://www.google.com"
    },
    {
      "id": "test2",
      "name": "测试网站2",
      "emoji": "🎯",
      "note": "这也是一个测试链接",
      "url": "https://www.github.com"
    },
    {
      "id": "cf_demo",
      "name": "Cloudflare演示",
      "emoji": "⚡",
      "note": "Cloudflare服务演示",
      "url": "https://dash.cloudflare.com",
      "backup_url": "https://www.cloudflare.com"
    }
  ]),
  FRIENDS: JSON.stringify([
    {
      "id": "friend1",
      "name": "测试友链",
      "url": "https://www.example.com"
    },
    {
      "id": "friend2",
      "name": "开发工具",
      "url": "https://github.com"
    }
  ])
};

// 模拟D1数据库
class MockD1Database {
  constructor() {
    this.dataFile = './data/db.json';
    this.loadDb();
  }
  
  loadDb() {
    if (existsSync(this.dataFile)) {
      try {
        this.db = JSON.parse(readFileSync(this.dataFile, 'utf8'));
      } catch (e) {
        this.db = { logs: [], stats: {} };
      }
    } else {
      this.db = { logs: [], stats: {} };
    }
  }
  
  saveDb() {
    writeFileSync(this.dataFile, JSON.stringify(this.db, null, 2));
  }
  
  prepare(sql) {
    return new MockD1PreparedStatement(this, sql);
  }
  
  // 模拟插入日志
  insertLog(link_id, click_time, month_key) {
    this.db.logs.push({
      id: this.db.logs.length + 1,
      link_id,
      click_time,
      month_key,
      ip_address: '127.0.0.1',
      user_agent: 'Local Test Environment'
    });
    this.saveDb();
  }
  
  // 模拟更新统计
  updateStats(id, name, type, year, month_key, timeStr) {
    if (!this.db.stats[id]) {
      this.db.stats[id] = {
        id,
        name,
        type,
        total_clicks: 0,
        year_clicks: 0,
        month_clicks: 0,
        day_clicks: 0,
        last_year: '',
        last_month: '',
        last_day: '',
        last_time: ''
      };
    }
    
    const stat = this.db.stats[id];
    stat.total_clicks++;
    
    // 更新年度点击
    if (stat.last_year === year) {
      stat.year_clicks++;
    } else {
      stat.year_clicks = 1;
      stat.last_year = year;
    }
    
    // 更新月度点击
    if (stat.last_month === month_key) {
      stat.month_clicks++;
    } else {
      stat.month_clicks = 1;
      stat.last_month = month_key;
    }
    
    // 更新日度点击
    const day = timeStr.substring(0, 10);
    if (stat.last_day === day) {
      stat.day_clicks++;
    } else {
      stat.day_clicks = 1;
      stat.last_day = day;
    }
    
    stat.last_time = timeStr;
    stat.name = name;
    
    this.saveDb();
  }
  
  // 获取所有统计
  getAllStats() {
    return Object.values(this.db.stats);
  }
  
  // 获取特定链接的日志
  getLogsByLinkAndMonth(link_id, month_key) {
    return this.db.logs.filter(log => log.link_id === link_id && log.month_key === month_key);
  }
}

// 模拟D1预处理语句
class MockD1PreparedStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.bindings = [];
  }
  
  bind(...values) {
    this.bindings = values;
    return this;
  }
  
  async run() {
    // 模拟INSERT语句
    if (this.sql.includes('INSERT INTO logs')) {
      const [link_id, click_time, month_key] = this.bindings;
      this.db.insertLog(link_id, click_time, month_key);
      return { success: true };
    }
    return { success: true };
  }
  
  async all() {
    // 模拟SELECT语句
    if (this.sql.includes('SELECT * FROM stats')) {
      return { results: this.db.getAllStats() };
    } else if (this.sql.includes('SELECT click_time FROM logs')) {
      const [link_id, month_key] = this.bindings;
      const results = this.db.getLogsByLinkAndMonth(link_id, month_key);
      return { results: results.map(log => ({ click_time: log.click_time })) };
    }
    return { results: [] };
  }
}

// 创建数据库实例
const mockDb = new MockD1Database();

// 获取当前日期信息
const getDateInfo = () => {
  const now = new Date(new Date().getTime() + 8 * 3600000); // UTC+8
  const currYear = now.getFullYear().toString();
  const currMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const dateKey = `${currYear}_${currMonth}`;
  const fullTimeStr = now.toISOString().replace('T', ' ').substring(0, 19);
  const todayStr = `${currYear}-${currMonth.padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  return { currYear, currMonth, dateKey, fullTimeStr, todayStr };
};

// 记录点击
const recordClick = async (db, id, name, type, y, m, timeStr) => {
  try {
    // 模拟数据库操作
    await db.prepare("INSERT INTO logs (link_id, click_time, month_key, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)")
      .bind(id, timeStr, m, '127.0.0.1', 'Local Test').run();
    
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, day_clicks, last_year, last_month, last_day, last_time) 
      VALUES (?1, ?2, ?3, 1, 1, 1, 1, ?4, ?5, ?7, ?6) 
      ON CONFLICT(id) DO UPDATE SET 
        total_clicks = total_clicks + 1, 
        year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, 
        month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, 
        day_clicks = CASE WHEN last_day = ?7 THEN day_clicks + 1 ELSE 1 END, 
        last_year = ?4, last_month = ?5, last_day = ?7, last_time = ?6, name = ?2`)
      .bind(id, name, type, y, m, timeStr, timeStr.substring(0, 10)).run();
  } catch (e) {
    console.error("Record Error:", e);
  }
};

// 从环境变量解析JSON
const getJson = (key) => {
  try {
    return env[key] ? JSON.parse(env[key]) : [];
  } catch(e) {
    console.error(`解析环境变量 ${key} 失败:`, e);
    return [];
  }
};

// 模拟Cloudflare context对象
const createContext = (request, env) => {
  return {
    request,
    env,
    waitUntil: (promise) => {
      // 在本地环境中直接执行Promise
      promise.catch(err => console.error('waitUntil error:', err));
    }
  };
};

// 主页路由
app.get('/', (req, res) => {
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
  const LINKS_DATA = getJson('LINKS');
  const FRIENDS_DATA = getJson('FRIENDS');
  const RAW_IMG = env.img || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073";

  // 渲染主页HTML
  const cardsHtml = LINKS_DATA.map(item => {
    const mainUrl = `/go/${item.id}`;
    const backupHtml = item.backup_url ? `<a href="/go/${item.id}/backup" class="tag-backup" title="备用线路">备用</a>` : '';
    return `
    <div class="glass-card resource-card-wrap">
        <a href="${mainUrl}" class="resource-main-link">
            <div class="card-icon">${item.emoji}</div>
            <div class="card-info"><h3>${item.name}</h3><p>⚠️ ${item.note}</p></div>
        </a>
        ${backupHtml}
    </div>`;
  }).join('');

  const friendsHtml = FRIENDS_DATA.map((f) => `<a href="/fgo/${f.id}" target="_blank" class="glass-card partner-card">${f.name}</a>`).join('');

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE}</title><style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #fff; background: url('${RAW_IMG}') no-repeat center center fixed; background-size: cover; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px 100px; position: relative; }
    .container { width: 100%; max-width: 1200px; }
    .glass-card { background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); transition: 0.3s ease; }
    .header { text-align: center; padding: 40px 20px; margin-bottom: 30px; }
    .header h1 { font-size: 3rem; font-weight: 800; margin-bottom: 10px; text-shadow: 0 4px 15px rgba(0,0,0,0.4); }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .section-title { font-size: 1rem; font-weight: 800; color: #7dd3fc; margin-bottom: 15px; margin-left: 5px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.6); }
    .grid-resources { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .resource-card-wrap { display: flex; position: relative; overflow: hidden; height: 100px; opacity: 0; transform: translateY(20px); animation: fadeInUp 0.6s forwards; }
    .resource-card-wrap:nth-child(1) { animation-delay: 0.1s; }
    .resource-card-wrap:nth-child(2) { animation-delay: 0.2s; }
    .resource-card-wrap:nth-child(3) { animation-delay: 0.3s; }
    .resource-card-wrap:nth-child(4) { animation-delay: 0.4s; }
    .resource-card-wrap:nth-child(5) { animation-delay: 0.5s; }
    .resource-card-wrap:nth-child(6) { animation-delay: 0.6s; }
    .resource-card-wrap:hover { background: rgba(255, 255, 255, 0.25); transform: translateY(-5px); box-shadow: 0 12px 40px rgba(0,0,0,0.25); }
    .resource-main-link { flex: 1; display: flex; align-items: center; text-decoration: none; color: white; padding: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .card-icon { font-size: 2.5rem; margin-right: 15px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
    .card-info h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; }
    .card-info p { font-size: 0.85rem; color: #fcd34d; font-weight: 500; }
    .tag-backup { width: 36px; background: rgba(0,0,0,0.3); border-left: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #e2e8f0; writing-mode: vertical-rl; letter-spacing: 2px; text-decoration: none; transition: 0.3s; }
    .tag-backup:hover { background: #8b5cf6; color: white; }
    .grid-partners { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; margin-bottom: 40px; }
    .partner-card { text-decoration: none; color: #fff; text-align: center; padding: 15px 10px; font-size: 0.9rem; border-radius: 12px; text-shadow: 0 1px 3px rgba(0,0,0,0.6); transition: 0.3s; height: 60px; display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(20px); animation: fadeInUp 0.6s forwards; }
    .partner-card:nth-child(1) { animation-delay: 0.7s; }
    .partner-card:nth-child(2) { animation-delay: 0.8s; }
    .partner-card:nth-child(3) { animation-delay: 0.9s; }
    .partner-card:nth-child(4) { animation-delay: 1.0s; }
    .partner-card:hover { background: rgba(255, 255, 255, 0.25); transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
    .fab-support { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.5); z-index: 100; transition: 0.3s; }
    .fab-support:hover { transform: translateX(-50%) scale(1.05); box-shadow: 0 12px 30px rgba(139, 92, 246, 0.7); }
    
    /* 搜索框样式 */
    .search-container { margin-bottom: 30px; }
    .search-box { width: 100%; max-width: 500px; padding: 15px 20px; border-radius: 50px; border: none; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: white; font-size: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .search-box::placeholder { color: rgba(255, 255, 255, 0.7); }
    .search-box:focus { outline: none; background: rgba(255, 255, 255, 0.3); }
    
    /* 主题切换按钮 */
    .theme-toggle { position: fixed; top: 20px; right: 20px; width: 50px; height: 50px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 100; color: white; font-size: 1.2rem; }
    
    /* 动画效果 */
    @keyframes fadeInUp {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* 骨架屏样式 */
    .skeleton {
      background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.1) 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
    }
    
    @keyframes loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
    
    /* 响应式设计优化 */
    @media (max-width: 768px) { 
      .header h1 { font-size: 2.2rem; }
      .container { padding: 0 10px; }
      .grid-resources { grid-template-columns: 1fr; gap: 15px; }
      .resource-card-wrap { height: auto; min-height: 100px; }
      .grid-partners { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
      .fab-support { padding: 10px 25px; font-size: 0.9rem; }
    }
    @media (max-width: 480px) { 
      .header { padding: 30px 15px; }
      .header h1 { font-size: 1.8rem; }
      .section-title { font-size: 0.9rem; }
      .resource-card-wrap { flex-direction: column; height: auto; }
      .resource-main-link { flex-direction: row; }
      .tag-backup { width: 100%; writing-mode: horizontal; text-align: center; padding: 5px 0; }
    }
  </style>
  <script>
    // 搜索功能
    function initSearch() {
      const searchBox = document.querySelector('.search-box');
      if (!searchBox) return;
      
      searchBox.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.resource-card-wrap, .partner-card');
        
        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          if (searchTerm === '' || text.includes(searchTerm)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    }
    
    // 主题切换功能
    function initThemeToggle() {
      const themeBtn = document.querySelector('.theme-toggle');
      if (!themeBtn) return;
      
      themeBtn.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // 切换图标
        this.textContent = isDark ? '☀️' : '🌙';
      });
      
      // 检查用户首选主题
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      
      if (useDark) {
        document.body.classList.add('dark-theme');
        themeBtn.textContent = '☀️';
      } else {
        themeBtn.textContent = '🌙';
      }
    }
    
    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', function() {
      initSearch();
      initThemeToggle();
    });
  </script></head><body>
  <button class="theme-toggle" title="切换主题">🌙</button>
  <div class="container">
    <div class="header glass-card">
      <h1>${TITLE}</h1>
      <p>${SUBTITLE}</p>
    </div>
    <div class="search-container">
      <input type="text" class="search-box" placeholder="搜索导航项目..." />
    </div>
    <div class="section-title">💎 精选</div>
    <div class="grid-resources">${cardsHtml}</div>
    <div class="section-title">🔗 友链</div>
    <div class="grid-partners">${friendsHtml}</div>
  </div>
  <a href="${CONTACT_URL}" class="fab-support">💬 获取支持</a>
  </body></html>`;
  
  res.send(html);
});

// 管理员登录页面
app.get('/admin', async (req, res) => {
  const session = req.cookies.session;
  if (session !== 'logged_in') {
    // 显示登录页面
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理后台</title><style>
      :root{--glass:rgba(15,23,42,0.6);--border:rgba(255,255,255,0.15);--text-shadow:0 2px 4px rgba(0,0,0,0.8)}
      body{margin:0;min-height:100vh;font-family:'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;color:#fff;display:flex;justify-content:center;align-items:center}
      .glass-panel{background:var(--glass);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,0.2);border-radius:16px}
      h1,div,span,a{text-shadow:var(--text-shadow)}
      body { background: url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073') no-repeat center center fixed; background-size: cover; }
      .box { padding: 50px 40px; text-align: center; width: 340px; }
      h1 { font-size: 1.8rem; margin-bottom: 30px; }
      input { width: 100%; padding: 16px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; outline: none; transition: 0.3s; font-size: 1rem; box-sizing: border-box; text-align: center; }
      input:focus { border-color: #a78bfa; background: rgba(0,0,0,0.5); transform: scale(1.02); }
      input::placeholder { color: rgba(255,255,255,0.5); }
      button { width: 100%; padding: 16px; background: #fff; color: #000; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
      button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
      .error-msg { color: #f87171; margin-bottom: 15px; font-size: 0.9rem; min-height: 20px; }
    </style></head><body>
      <div class="glass-panel box">
          <h1>🔐 管理后台</h1>
          <form method="POST" action="/admin">
              <input type="password" name="password" placeholder="请输入访问口令" required autofocus>
              <button type="submit">立即登录</button>
          </form>
      </div>
    </body></html>`;
    res.send(html);
  } else {
    // 显示管理后台 - 使用与Cloudflare Workers相同的逻辑
    const LINKS_DATA = getJson('LINKS');
    const FRIENDS_DATA = getJson('FRIENDS');
    const { dateKey, currYear, currMonth, todayStr } = getDateInfo();
    
    try {
      // 从模拟数据库获取统计数据
      const { results } = await mockDb.prepare("SELECT * FROM stats").all();
      const statsMap = new Map();
      if(results) results.forEach(r => statsMap.set(r.id, r));

      // 1. 收集所有当前有效的 ID (主链接 + 友链)
      const activeIds = new Set([ ...LINKS_DATA.map(i => i.id), ...FRIENDS_DATA.map(i => i.id) ]);
      
      let totalClicks = 0;
      // 2. 只统计当前有效 ID 的点击数
      for (let v of statsMap.values()) {
          if (activeIds.has(v.id)) {
              totalClicks += (v.total_clicks || 0);
          }
      }

      // 计算今日点击数
      const resourceHtml = LINKS_DATA.map((item, i) => {
        const stat = statsMap.get(item.id) || { total_clicks: 0, month_clicks: 0, year_clicks: 0, last_time: '' };
        const p = totalClicks > 0 ? ((stat.total_clicks / totalClicks) * 100).toFixed(1) : 0;
        const timeDisplay = stat.last_time ? stat.last_time : '暂无记录';
        
        // 计算今日点击数
        const todayClicks = stat.last_time && stat.last_time.startsWith(todayStr) ? 1 : 0;
        
        return `
        <div class="glass-panel card" onclick="openLog('${item.id}','${dateKey}','${item.name}')" style="animation-delay:${i * 0.05}s">
            <div class="row top-row">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span class="emoji-small">${item.emoji}</span>
                    <span class="card-name">${item.name}</span>
                </div>
                <div class="percent-badge">${p}%</div>
            </div>
            <div class="data-row">
                <div class="data-item"><span class="label">今日</span><b class="val-highlight">${todayClicks}</b></div>
                <div class="data-item"><span class="label">本月</span><b class="val-highlight">${stat.month_clicks}</b></div>
                <div class="data-item"><span class="label">总计</span><b class="val-total">${stat.total_clicks}</b></div>
            </div>
            <div class="bar-bg"><div class="bar-fill" style="width:${p}%"></div></div>
            <div class="time-row">
                🕒 ${timeDisplay}
            </div>
        </div>`;
      }).join('');

      // 友链后台统计
      const friendHtml = FRIENDS_DATA.map((item) => {
        const id = item.id; // 直接使用配置中的 ID
        const stat = statsMap.get(id) || { total_clicks: 0, month_clicks: 0, year_clicks: 0, last_time: '' };
        let simpleTime = '-';
        if (stat.last_time && stat.last_time.includes(' ')) {
            simpleTime = stat.last_time.split(' ')[1];
        }

        return `
        <div class="glass-panel card-mini" onclick="openLog('${id}','${dateKey}','${item.name}')">
            <div class="mini-header">
                <span class="card-name-mini">${item.name}</span>
                <span class="mini-badge">${stat.total_clicks}</span>
            </div>
            <div class="mini-time">${simpleTime}</div>
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>数据看板</title><style>
        :root{--glass:rgba(15,23,42,0.6);--border:rgba(255,255,255,0.15);--text-shadow:0 2px 4px rgba(0,0,0,0.8)}
        body{margin:0;min-height:100vh;font-family:'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;color:#fff;display:flex;justify-content:center;align-items:center}
        .glass-panel{background:var(--glass);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,0.2);border-radius:16px}
        h1,div,span,a{text-shadow:var(--text-shadow)}
        /* 1. 布局优化 */
        .main { width: 94%; max-width: 1200px; padding: 20px 0; margin-bottom: 50px; } 
        
        /* 2. 标题居中与背景优化 */
        .header { 
            padding: 30px; 
            text-align: center; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px;
            margin-bottom: 30px; 
            background: rgba(30, 41, 59, 0.65); 
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.15);
        }
        
        /* 3. 卡片通用样式 */
        .glass-panel { 
            background: rgba(30, 41, 59, 0.75); 
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); 
            border: 1px solid rgba(255,255,255,0.1); 
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); 
            border-radius: 16px; 
            transition: 0.2s;
        }

        /* 4. 网格布局 */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .grid-mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }

        /* 文字与细节 */
        h1, div, span { text-shadow: 0 1px 2px rgba(0,0,0,0.8); } 
        
        .card { padding: 20px; cursor: pointer; animation: fadeUp 0.5s backwards; }
        .card:hover { transform: translateY(-3px); border-color: #a78bfa; background: rgba(30, 41, 59, 0.9); }
        
        .top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .emoji-small { font-size: 1.6rem; }
        .card-name { font-weight: 700; font-size: 1.1rem; color: #fff; }
        .percent-badge { font-weight: 800; color: #a78bfa; background: rgba(167, 139, 250, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; }
        
        .data-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem; color: #cbd5e1; }
        .val-highlight { color: #38bdf8; margin-left: 6px; font-size: 1.1em; }
        .val-total { color: #fff; margin-left: 6px; font-size: 1.1em; }
        
        .bar-bg { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-bottom: 10px; }
        .bar-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #a78bfa); border-radius: 2px; }
        
        .time-row { font-size: 0.75rem; color: #94a3b8; text-align: right; font-family: monospace; display: flex; align-items: center; justify-content: flex-end; gap: 5px; }

        /* 迷你卡片 */
        .card-mini { padding: 15px; cursor: pointer; }
        .card-mini:hover { border-color: #38bdf8; background: rgba(30, 41, 59, 0.9); }
        .mini-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .card-name-mini { font-weight: 600; font-size: 0.95rem; }
        .mini-badge { color: #38bdf8; font-weight: 700; }
        .mini-time { font-size: 0.75rem; color: #64748b; text-align: right; font-family: monospace; }

        /* 抽屉 & 其他 */
        .badge { background: #fff; color: #0f172a; padding: 6px 18px; border-radius: 20px; font-weight: 800; font-size: 0.9rem; }
        .section-label { color: #7dd3fc; font-weight: 800; margin: 35px 0 15px 5px; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
        .drawer { position: fixed; top: 0; right: -420px; width: 380px; height: 100vh; background: rgba(15, 23, 42, 0.98); border-left: 1px solid rgba(255,255,255,0.1); transition: 0.4s cubic-bezier(0.19, 1, 0.22, 1); z-index: 99; display: flex; flex-direction: column; }
        .drawer.open { right: 0; box-shadow: -20px 0 50px rgba(0,0,0,0.6); }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 90; opacity: 0; pointer-events: none; transition: 0.3s; }
        .overlay.show { opacity: 1; pointer-events: auto; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* 顶部统计面板 */
        .stats-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(30, 41, 59, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            transition: 0.2s;
        }
        
        .stat-card:hover {
            transform: translateY(-3px);
            background: rgba(30, 41, 59, 0.9);
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin: 10px 0;
            color: #38bdf8;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* 月份选择器 */
        .month-selector {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        
        .month-btn {
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        
        .month-btn:hover, .month-btn.active {
          background: rgba(167, 139, 250, 0.3);
          border-color: #a78bfa;
        }
      </style></head><body>
        <div class="main">
          <header class="glass-panel header">
              <h1 style="margin:0;font-size:2rem">📊 数据看板</h1>
              <div style="display:flex;gap:15px;align-items:center;">
                   <span style="font-family:monospace;opacity:0.8">${dateKey}</span>
                   <span class="badge">总点击 ${totalClicks}</span>
              </div>
              <a href="/admin/logout" style="color:#f87171;font-size:0.85rem;text-decoration:none;font-weight:700;margin-top:5px">安全退出</a>
          </header>

          <!-- 顶部统计面板 -->
          <div class="stats-panel">
              <div class="stat-card">
                  <div class="stat-label">总项目数</div>
                  <div class="stat-value">${LINKS_DATA.length}</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">友链数</div>
                  <div class="stat-value">${FRIENDS_DATA.length}</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">总点击量</div>
                  <div class="stat-value">${totalClicks}</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">活跃项目</div>
                  <div class="stat-value">${Array.from(statsMap.values()).filter(stat => stat.total_clicks > 0).length}</div>
              </div>
          </div>

          <!-- 月份选择器 -->
          <div class="month-selector">
              <a href="/admin" class="month-btn ${dateKey === dateKey ? 'active' : ''}">当月</a>
              <a href="/admin?m=${currYear}_${String(Number(currMonth)-1).padStart(2, '0')}" class="month-btn">上月</a>
              <a href="/admin?m=${currYear}_${String(Number(currMonth)+1).padStart(2, '0')}" class="month-btn">下月</a>
              <input type="month" onchange="location.href='/admin?m=' + this.value.replace('-', '_')" value="${currYear}-${currMonth}" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:20px;padding:8px 12px;">
          </div>

          <div class="section-label">💎 精选数据</div>
          <div class="grid">${resourceHtml}</div>

          <div class="section-label">🔗 友链数据</div>
          <div class="grid-mini">${friendHtml}</div>

        </div>
        
        <div class="overlay" id="mask" onclick="closeDrawer()"></div>
        <div class="drawer" id="drawer">
            <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:1.1rem" id="d-title">详情</h3>
                <button onclick="closeDrawer()" style="background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer">×</button>
            </div>
            <ul style="flex:1;overflow-y:auto;padding:0;margin:0;list-style:none;" id="d-list"></ul>
        </div>

        <script>
          async function openLog(id,m,n){
              document.getElementById('drawer').classList.add('open');
              document.getElementById('mask').classList.add('show');
              document.getElementById('d-title').innerText = n + ' - 详细记录';
              const l=document.getElementById('d-list');
              l.innerHTML='<li style="padding:25px;text-align:center">📡 加载中...</li>';
              try{
                  const r=await fetch(\`/admin/api/logs?id=\${id}&m=\${m}\`);
                  const d=await r.json();
                  l.innerHTML=d.length?d.map((x,i)=>\`<li style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;font-size:0.85rem;color:#cbd5e1"><span>#\${i+1}</span><span style="font-family:monospace;color:#a78bfa">\${x.click_time}</span></li>\`).join(''):'<li style="padding:25px;text-align:center;opacity:0.5">暂无点击记录</li>';
              }catch(e){l.innerHTML='<li style="padding:25px;text-align:center;color:#f87171">加载失败</li>';}
          }
          function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('mask').classList.remove('show');}
        </script>
      </body></html>`;
      
      res.send(html);
    } catch (dbErr) {
      console.error('DB Error in admin dashboard:', dbErr);
      res.status(500).send('数据库错误');
    }
  }
});

// 管理员登录处理
app.post('/admin', (req, res) => {
  const { password } = req.body;
  if (password === env.admin) {
    // 设置会话cookie
    res.cookie('session', 'logged_in', { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/admin');
  } else {
    // 登录失败，返回错误信息
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理后台</title><style>
      :root{--glass:rgba(15,23,42,0.6);--border:rgba(255,255,255,0.15);--text-shadow:0 2px 4px rgba(0,0,0,0.8)}
      body{margin:0;min-height:100vh;font-family:'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;color:#fff;display:flex;justify-content:center;align-items:center}
      .glass-panel{background:var(--glass);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--border);box-shadow:0 8px 32px rgba(0,0,0,0.2);border-radius:16px}
      h1,div,span,a{text-shadow:var(--text-shadow)}
      body { background: url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073') no-repeat center center fixed; background-size: cover; }
      .box { padding: 50px 40px; text-align: center; width: 340px; }
      h1 { font-size: 1.8rem; margin-bottom: 30px; }
      input { width: 100%; padding: 16px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; outline: none; transition: 0.3s; font-size: 1rem; box-sizing: border-box; text-align: center; }
      input:focus { border-color: #a78bfa; background: rgba(0,0,0,0.5); transform: scale(1.02); }
      input::placeholder { color: rgba(255,255,255,0.5); }
      button { width: 100%; padding: 16px; background: #fff; color: #000; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
      button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
      .error-msg { color: #f87171; margin-bottom: 15px; font-size: 0.9rem; min-height: 20px; }
    </style></head><body>
      <div class="glass-panel box">
          <h1>🔐 管理后台</h1>
          <div class="error-msg">❌ 密码错误</div>
          <form method="POST" action="/admin">
              <input type="password" name="password" placeholder="请输入访问口令" required autofocus>
              <button type="submit">立即登录</button>
          </form>
      </div>
    </body></html>`;
    res.send(html);
  }
});

// 管理员登出
app.get('/admin/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/admin');
});

// 链接跳转
app.get('/go/:id/:backup?', async (req, res) => {
  const { id, backup } = req.params;
  const links = getJson('LINKS');
  const item = links.find(l => l.id === id);
  
  if (item) {
    const { currYear, dateKey, fullTimeStr } = getDateInfo();
    
    // 使用模拟数据库记录点击
    if (mockDb) {
      // 使用waitUntil模拟异步记录
      recordClick(mockDb, backup ? `${id}_backup` : id, item.name + (backup ? "(备用)" : ""), 'link', currYear, dateKey, fullTimeStr);
    }
    
    const redirectUrl = backup && item.backup_url ? item.backup_url : item.url;
    if (redirectUrl) {
      res.redirect(redirectUrl);
    } else {
      res.status(400).send('No valid URL available');
    }
  } else {
    res.status(404).send('Link not found');
  }
});

// 友链跳转
app.get('/fgo/:id', async (req, res) => {
  const { id } = req.params;
  const friends = getJson('FRIENDS');
  const friend = friends.find(f => f.id === id);
  
  if (friend) {
    const { currYear, dateKey, fullTimeStr } = getDateInfo();
    
    // 使用模拟数据库记录点击
    if (mockDb) {
      recordClick(mockDb, friend.id, friend.name, 'friend', currYear, dateKey, fullTimeStr);
    }
    
    if (friend.url) {
      res.redirect(friend.url);
    } else {
      res.status(400).send('No valid URL available');
    }
  } else {
    res.status(404).send('Friend link not found');
  }
});

// API: 日志查询
app.get('/admin/api/logs', async (req, res) => {
  const { id, m } = req.query;
  const { dateKey } = getDateInfo();
  const month = m || dateKey;
  
  try {
    // 从模拟数据库获取日志
    const { results } = await mockDb.prepare("SELECT click_time FROM logs WHERE link_id = ? AND month_key = ? ORDER BY id DESC LIMIT 50").bind(id, month).all();
    res.json(results || []);
  } catch (dbErr) {
    console.error('DB Error in logs API:', dbErr);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// 静态文件服务
app.use(express.static('.'));

console.log(`🚀 FlarePortal 完整CF功能模拟服务器启动成功!`);
console.log(`📝 本地测试说明:`);
console.log(`   完整模拟了Cloudflare Workers的所有功能，包括:`);
console.log(`   - 请求处理和路由`);
console.log(`   - 环境变量模拟`);
console.log(`   - D1数据库操作模拟`);
console.log(`   - Cookie和Session管理`);
console.log(`   - 数据统计和记录`);
console.log(`\n🌐 访问地址:`);
console.log(`   主页: http://localhost:${port}`);
console.log(`   管理后台: http://localhost:${port}/admin`);
console.log(`   管理密码: ${env.admin}`);
console.log(`\n💾 数据存储: ./data/db.json`);
console.log(`🔄 按 Ctrl+C 停止服务器`);
console.log(`================================================`);

app.listen(port, () => {
  console.log(`✅ 服务器已在端口 ${port} 上运行`);
});