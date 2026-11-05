// Chụp HTML SAU KHI chạy JS bằng Edge headless + CDP (chỉ GET).
// Dùng:
//   node _tools/capture-browser.js --probe                 # xem title/độ dài, không ghi
//   node _tools/capture-browser.js --fetch                 # ghi file vào haravan_dashboard_html/
//   node _tools/capture-browser.js --probe --url=/admin/draft_orders
//   node _tools/capture-browser.js --probe --local=http://127.0.0.1:3100/orders.html   # kiểm tra bản clone
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => fs.existsSync(p));
const PORT = 9333;
const HOST = 'noritake.myharavan.com';
const BASE = 'https://' + HOST;
const FETCH = process.argv.includes('--fetch');
const argOf = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];

const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')]
  .find(p => fs.existsSync(p));

const TARGETS = [
  ['/admin/draft_orders', 'draft_orders.html'],
  ['/admin/inventory/inventory_receives', 'inventory_inventory_receives.html'],
  ['/admin/inventory/purchase_returns', 'inventory_purchase_returns.html']
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = url => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));

function parseCookies(str) {
  return str.split(/;\s*/).map(p => p.trim()).filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return { name: p.slice(0, i), value: p.slice(i + 1), domain: '.' + HOST, path: '/', secure: true };
  }).filter(c => c.name);
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; this.onEvent = null; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method === 'Fetch.requestPaused') { if (c.onEvent) c.onEvent(m); }
      else if (m.method) c.events.push(m);
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  waitEvent(method, timeout = 15000) {
    const start = this.events.length;
    return new Promise(res => {
      const t0 = Date.now();
      const tick = () => {
        const hit = this.events.slice(start).find(e => e.method === method);
        if (hit) return res(hit);
        if (Date.now() - t0 > timeout) return res(null);
        setTimeout(tick, 50);
      };
      tick();
    });
  }
}

(async () => {
  const localUrl = argOf('local');
  const only = argOf('url');
  const planFile = argOf('plan');
  let plan = null;
  if (planFile) {
    plan = fs.readFileSync(path.resolve(__dirname, planFile), 'utf8').split(/\r?\n/)
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => l.split('\t').map(s => s.trim()));
  }
  const targets = plan ? plan
    : localUrl ? [['local', '']]
      : only ? [[only, only.replace(/^\/admin\/?/, '').replace(/\//g, '_') + '.html']]
        : TARGETS;

  const needCookie = !localUrl;
  if (needCookie && !COOKIE_FILE) { console.error('Thiếu _mirror/cookie.txt'); process.exit(1); }
  if (!EDGE) { console.error('Không tìm thấy Edge/Chrome để chụp.'); process.exit(1); }

  const profile = path.join(require('os').tmpdir(), 'edge-cdp-' + Date.now());
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });

  let browserWs;
  for (let i = 0; i < 60; i++) {
    try { const v = await jget(`http://127.0.0.1:${PORT}/json/version`); browserWs = v.webSocketDebuggerUrl; break; }
    catch (e) { await sleep(400); }
  }
  if (!browserWs) { edge.kill(); throw new Error('Edge không mở được cổng debug'); }

  const cdp = await CDP.connect(browserWs);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  if (needCookie) {
    const cookies = parseCookies(fs.readFileSync(COOKIE_FILE, 'utf8'));
    await cdp.send('Network.setCookies', { cookies }, sessionId);
    console.log('Đã nạp ' + cookies.length + ' cookie vào trình duyệt.');
  }

  const ok = [], bad = [];

  // ═══ ENFORCEMENT: chỉ GET/HEAD/OPTIONS được đi ra ngoài ═══
  // Chặn ở tầng network nên áp dụng cho CẢ request do JS của site tự phát (fetch/XHR/sendBeacon/form).
  const BLOCKED = [];
  let SENT = 0;
  const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const LOG_DIR = path.join(__dirname, 'logs');
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const LOG_FILE = path.join(LOG_DIR, 'net-' + DAY + '.log');
  let logBuf = [];
  const flushLog = () => { if (!logBuf.length) return; try { fs.appendFileSync(LOG_FILE, logBuf.join('\n') + '\n'); } catch (e) {} logBuf = []; };
  const netLog = line => { logBuf.push(line); if (logBuf.length >= 200) flushLog(); };
  process.on('exit', flushLog);
  cdp.onEvent = m => {
    if (m.method !== 'Fetch.requestPaused') return;
    const sid = m.sessionId || sessionId;
    const p = m.params || {};
    const req = p.request || {};
    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.url || '');
    const short = url.length > 160 ? url.slice(0, 160) + '…' : url;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      SENT++;
      netLog('[' + method + '] ' + short);
      cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sid).catch(() => {});
    } else {
      BLOCKED.push({ method, url });
      netLog('[BLOCKED] ' + method + ' ' + short);
      cdp.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }, sid).catch(() => {});
      console.log('   [BLOCKED] ' + method + ' ' + short);
    }
  };
  // Chỉ intercept các loại request có thể mang thao tác ghi; ảnh/CSS/JS/font đi thẳng cho nhanh.
  await cdp.send('Fetch.enable', {
    patterns: ['Document', 'XHR', 'Fetch', 'Ping', 'Other']
      .map(resourceType => ({ urlPattern: '*', resourceType, requestStage: 'Request' }))
  }, sessionId);

  async function render(full, label) {
    await cdp.send('Page.navigate', { url: full }, sessionId);
    await cdp.waitEvent('Page.loadEventFired', 25000);
    // chờ SPA render xong: title khác "Omni ~ Haravan" và có nội dung lớn
    let title = '', html = '';
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const r = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }, sessionId);
      html = (r.result && r.result.value) || '';
      const t = await cdp.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
      title = (t.result && t.result.value) || '';
      if (html.length > 30000 && !/^Omni ~ Haravan$/.test(title)) break;
    }
    const isLogin = /<title>[^<]*(Đăng nhập|Sign in|Login)/i.test(html) || (/name="password"/.test(html) && html.length < 60000);
    const is404 = /Lỗi 404/.test(title);
    const good = html.length > 20000 && !isLogin && !is404;
    console.log(`${good ? 'OK  ' : 'HỎNG'} ${label}  bytes=${html.length}  title=${title}${isLogin ? '  <-- trang đăng nhập' : ''}${is404 ? '  <-- Lỗi 404' : ''}`);
    return { good, title, html };
  }

  const toWrite = [];
  for (const [url, file] of targets) {
    const full = localUrl || (BASE + url);
    const label = localUrl || url;
    const r = await render(full, label);
    if (!r.good) { bad.push(label); continue; }
    ok.push([file, r.html]);
    toWrite.push([file, r.html]);
  }

  // --details: chụp lại các trang chi tiết đơn nháp đã có sẵn tên file
  if (process.argv.includes('--details') && !localUrl && !only) {
    const listHtml = ok.find(([f]) => f === 'draft_orders.html');
    if (listHtml) {
      const ids = [...new Set([...listHtml[1].matchAll(/\/admin\/draft_orders\/([0-9a-f]{20,})/g)].map(m => m[1]))];
      const existing = fs.readdirSync(ROOT).filter(f => /^draft_orders_[0-9a-f]{20,}\.html$/.test(f)).map(f => f.replace('draft_orders_', '').replace('.html', ''));
      const need = existing.filter(id => ids.includes(id));
      console.log(`\nDanh sách có ${ids.length} đơn nháp; file clone cần chụp: ${need.length}/${existing.length}`);
      for (const id of need) {
        const r = await render(BASE + '/admin/draft_orders/' + id, 'draft_orders/' + id);
        if (r.good) toWrite.push(['draft_orders_' + id + '.html', r.html]); else bad.push('draft_orders/' + id);
      }
      const stale = existing.filter(id => !ids.includes(id));
      if (stale.length) console.log('Không còn trong danh sách (vẫn là 404): ' + stale.join(', '));
    }
  }

  await cdp.send('Browser.close').catch(() => {});
  edge.kill();

  if (FETCH) {
    if (!fs.existsSync(path.join(__dirname, '_backup'))) fs.mkdirSync(path.join(__dirname, '_backup'), { recursive: true });
    for (const [file, html] of toWrite) {
      if (!file) continue;
      const out = path.join(ROOT, file);
      if (fs.existsSync(out)) fs.copyFileSync(out, path.join(__dirname, '_backup', file + '.old'));
      // bỏ JS của chính site để giao diện "đóng băng" như các trang clone khác
      const cleaned = html
        .replace(/<script\b[^>]*src="(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/[^"]*"[^>]*><\/script>/gi, '')
        .replace(/<script\b[^>]*src="\/admin\/assets\/[^"]*"[^>]*><\/script>/gi, '');
      fs.writeFileSync(out, '<!DOCTYPE html>\n' + cleaned.replace(/^<!DOCTYPE html>\s*/i, ''), 'utf8');
      console.log('   đã ghi → ' + file + '  (' + cleaned.length + ' bytes)');
    }
  }
  console.log(`\nOK=${ok.length}  HỎNG=${bad.length}  chế độ=${FETCH ? 'GHI FILE' : 'CHỈ XEM'}`);
  if (bad.length) console.log('Cần xử lý: ' + bad.join(', '));

  flushLog();
  const byMethod = {};
  for (const b of BLOCKED) byMethod[b.method] = (byMethod[b.method] || 0) + 1;
  console.log('\n── NETWORK GUARD ──');
  console.log('Request đã log: ' + SENT + '  |  chặn non-GET: ' + BLOCKED.length
    + (BLOCKED.length ? ' (' + Object.entries(byMethod).map(([k, v]) => k + '=' + v).join(', ') + ')' : ''));
  console.log('Log: ' + path.relative(path.join(__dirname, '..'), LOG_FILE));
  if (BLOCKED.length) console.log('Mẫu bị chặn: ' + BLOCKED.slice(0, 5).map(b => b.method + ' ' + (b.url.length > 100 ? b.url.slice(0, 100) + '…' : b.url)).join(' | '));
})().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
