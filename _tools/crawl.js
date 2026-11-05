// Crawler clone Haravan admin — CHỈ GET, có cookie phiên, render bằng Edge headless (CDP).
// Dùng:
//   node _tools/crawl.js --dry --max=8 --depth=1        # chỉ khám phá, không ghi
//   node _tools/crawl.js --max=400 --depth=5            # chụp và ghi file
//   node _tools/crawl.js --prefix=/admin/products        # giới hạn mô-đun
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => fs.existsSync(p));
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';
const BASE = 'https://' + HOST;
const PORT = 9334;

const argOf = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const DRY = process.argv.includes('--dry');
const MAX = Number(argOf('max') || 400);
const MAX_DEPTH = Number(argOf('depth') || 5);
const LIMIT_PREFIX = argOf('prefix');
const SEED_ARG = argOf('seed');
const SEEDS_ARG = argOf('seeds') ? argOf('seeds').split(',').map(s => s.trim()).filter(Boolean) : null;
const PLAN = argOf('plan');
const ONLY = argOf('only') ? new RegExp(argOf('only')) : null;
const EXCLUDE = argOf('exclude') ? new RegExp(argOf('exclude')) : null;
const FAST = process.argv.includes('--fast');
const SKIP = argOf('skip') ? new RegExp(argOf('skip')) : null;

// 8 trang gốc người dùng yêu cầu + tiền tố được phép đi theo
const SEEDS = [
  '/admin/dashboard/generals',
  '/admin/orders',
  '/admin/products',
  '/admin/customers',
  '/admin/inventory/transactions',
  '/admin/accounting/transactions',
  '/admin/discounts',
  '/admin/reports/dashboard'
];
const PREFIXES = [
  '/admin/dashboard',
  '/admin/orders',
  '/admin/draft_orders',
  '/admin/products',
  '/admin/customers',
  '/admin/inventory',
  '/admin/accounting',
  '/admin/discounts',
  '/admin/reports',
  '/admin/settings',
  '/admin/sale_channels',
  '/admin/marketings',
  '/admin/googleshop',
  '/admin/shipments',
  '/admin/apps'
];
const ALLOWED = SEED_ARG ? [LIMIT_PREFIX || SEED_ARG] : (LIMIT_PREFIX ? [LIMIT_PREFIX] : PREFIXES);
let SEEDS_USED = SEEDS_ARG ? SEEDS_ARG : (SEED_ARG ? [SEED_ARG] : SEEDS);
// Customers & Reports là app NHÚNG IFRAME (customers.haravan.app / reports.haravan.app)
// -> trang bọc vẫn chụp, nhưng không crawl các trang con (chúng chỉ là iframe rỗng)
const IFRAME_MODULES = ['/admin/customers', '/admin/reports'];

const SPECIAL = { '/admin': 'index.html', '/admin/': 'index.html', '/admin/dashboard/generals': 'index.html' };
function fileFor(p) {
  if (SPECIAL[p]) return SPECIAL[p];
  const q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!q) return 'index.html';
  return q.replace(/\//g, '_') + '.html';
}
const segs = p => p.replace(/^\/admin\/?/, '').split('/').filter(Boolean).length;
const inScope = p => ALLOWED.some(x => p === x || p.startsWith(x + '/'));
const isIframeModuleChild = p => IFRAME_MODULES.some(x => p.startsWith(x + '/')) && !SEEDS.includes(p);

// Chuyển link trong HTML vừa chụp thành link LOCAL ngay khi ghi file.
// (file đích chưa tồn tại thì để URL tuyệt đối; relink.js ở cuối sẽ xử lý nốt)
function localize(out) {
  out = out.replace(/((?:href|src|action)=")\/admin\/([^"]*)(")/g, (a, pre, rest, post) => pre + BASE + '/admin/' + rest + post);
  out = out.replace(/((?:href|src|action)=")\/admin(")/g, (a, pre, post) => pre + BASE + '/admin' + post);
  out = out.replace(/((?:href|src|action)=")(https:\/\/noritake\.myharavan\.com\/admin(?:\/[^"]*)?)(")/g, (all, pre, url, post) => {
    const rest = url.slice((HOST + '/admin').length);
    if (!rest || rest === '/') return pre + 'index.html' + post;
    const rawPath = rest.replace(/^\//, '').split('?')[0].replace(/\/+$/, '');
    if (/^assets\//.test(rawPath)) return fs.existsSync(path.join(ROOT, rawPath)) ? pre + rawPath + post : all;
    if (rawPath === 'manifest.json' || rawPath === 'favicon.ico') return pre + rawPath + post;
    const f = fileFor('/admin/' + rawPath);
    return f && fs.existsSync(path.join(ROOT, f)) ? pre + f + post : all;
  });
  return out;
}

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
  waitEvent(method, timeout = 20000) {
    const start = this.events.length, t0 = Date.now();
    return new Promise(res => {
      const tick = () => {
        if (this.events.slice(start).some(e => e.method === method)) return res(true);
        if (Date.now() - t0 > timeout) return res(false);
        setTimeout(tick, 60);
      };
      tick();
    });
  }
}

(async () => {
  if (!EDGE) { console.error('Không thấy Edge/Chrome'); process.exit(1); }
  if (!COOKIE_FILE) { console.error('Thiếu _mirror/cookie.txt'); process.exit(1); }

  const profile = path.join(os.tmpdir(), 'edge-crawl-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

  let browserWs;
  for (let i = 0; i < 60; i++) {
    try { browserWs = (await jget(`http://127.0.0.1:${PORT}/json/version`)).webSocketDebuggerUrl; break; } catch { await sleep(400); }
  }
  if (!browserWs) { edge.kill(); throw new Error('Edge không mở cổng debug'); }

  const cdp = await CDP.connect(browserWs);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  const cookies = parseCookies(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await cdp.send('Network.setCookies', { cookies }, sessionId);

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

  console.log('Cookie nạp: ' + cookies.length + ' | chế độ: ' + (DRY ? 'DRY (không ghi)' : 'GHI FILE') + ' | max=' + MAX + ' depth=' + MAX_DEPTH);

  const queue = [];
  const seen = new Set();
  if (PLAN) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, PLAN), 'utf8'));
    SEEDS_USED = raw.map(x => (typeof x === 'string' ? x : x.url))
      .filter(u => !ONLY || ONLY.test(u))
      .filter(u => !EXCLUDE || !EXCLUDE.test(u))
      .filter(u => !/[?&]page=/.test(u))                            // KHÔNG clone phân trang
      .filter(u => { const f = fileFor(u); return !f || !fs.existsSync(path.join(ROOT, f)); }); // chỉ trang còn thiếu
  }
  for (const u of SEEDS_USED) { if (!seen.has(u)) { seen.add(u); queue.push([u, 0]); } }
  console.log('Hàng đợi ban đầu: ' + queue.length + ' URL' + (PLAN ? ' (từ ' + PLAN + ')' : ''));
  const done = [], failed = [], allLinks = new Map();

  while (queue.length && done.length + failed.length < MAX) {
    const [p, depth] = queue.shift();
    let html = '', title = '', lastInfo = {};
    try {
      await cdp.send('Page.navigate', { url: BASE + p }, sessionId);
      const loaded = await cdp.waitEvent('Page.loadEventFired', 25000);
      if (!loaded) await sleep(1500);
      // chờ MẠNG YÊN + DOM ỔN ĐỊNH (trang load dữ liệu bất đồng bộ)
      const evStart = cdp.events.length;
      const t0 = Date.now();
      let prevSig = '', stable = 0;
      for (let i = 0; i < 75; i++) {
        await sleep(400);
        const evs = cdp.events.slice(evStart);
        const inflight = evs.filter(e => e.method === 'Network.requestWillBeSent').length
          - evs.filter(e => e.method === 'Network.loadingFinished' || e.method === 'Network.loadingFailed').length;
        const r = await cdp.send('Runtime.evaluate', {
          expression: 'JSON.stringify({len:document.documentElement.outerHTML.length, tr:document.querySelectorAll("tr").length, a:document.querySelectorAll("a[href]").length, res:performance.getEntriesByType("resource").length, t:document.title})',
          returnByValue: true
        }, sessionId);
        const s = r.result && r.result.value || '';
        let info = {};
        try { info = JSON.parse(s); } catch { info = { len: 0, tr: 0, a: 0, res: 0, t: '' }; }
        title = info.t || '';
        lastInfo = info;
        const elapsed = Date.now() - t0;
        const minWait = FAST ? 1200 : 2000;
        const needStable = FAST ? 2 : 4;
        if (elapsed > minWait && inflight <= 0 && info.len > 30000 && s === prevSig) stable++; else stable = 0;
        prevSig = s;
        if (stable >= needStable) break;
      }
      const r2 = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }, sessionId);
      html = (r2.result && r2.result.value) || '';
    } catch (e) { failed.push(p + ' (' + e.message + ')'); continue; }

    const is404 = /Lỗi 404/.test(title);
    const isLogin = /<title>[^<]*(Đăng nhập|Sign in|Login)/i.test(html);
    const good = html.length > 20000 && !is404 && !isLogin;
    const file = fileFor(p);
    console.log(`${good ? 'OK  ' : 'HỎNG'} d${depth} ${String(html.length).padStart(7)}  tr=${lastInfo.tr} a=${lastInfo.a}  ${p}  → ${file}  | ${title.replace(/^Noritake Vietnam ~ |~ Haravan$/g, '')}`);
    if (!good) { failed.push(p + ' [' + title.replace(/^Noritake Vietnam ~ |~ Haravan$/g, '') + ']'); continue; }

    // thu link con TRƯỚC khi ghi file
    let hrefs = [];
    try {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify([...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href")))',
        returnByValue: true
      }, sessionId);
      hrefs = JSON.parse(r.result.value || '[]');
    } catch { /* bỏ qua */ }

    const kids = new Set();
    for (const h of hrefs) {
      if (!h || h.startsWith('#') || /^(mailto|javascript|tel):/.test(h)) continue;
      let u;
      try { u = new URL(h, BASE + p); } catch { continue; }
      if (u.host !== HOST) continue;
      const pn = decodeURI(u.pathname).replace(/\/+$/, '') || '/';
      if (!inScope(pn)) continue;
      if (isIframeModuleChild(pn)) continue;
      if (SKIP && SKIP.test(pn)) continue;
      if (pn === p) continue;
      kids.add(pn);
      if (!seen.has(pn) && depth + 1 <= MAX_DEPTH) { seen.add(pn); queue.push([pn, depth + 1]); }
    }
    allLinks.set(p, kids.size);
    console.log('      ↳ link con trong phạm vi: ' + kids.size);

    if (!DRY) {
      const out = path.join(ROOT, file);
      const backup = path.join(__dirname, '_backup', file + '.old');
      if (fs.existsSync(out) && !fs.existsSync(backup)) {
        if (!fs.existsSync(path.dirname(backup))) fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(out, backup);
      }
      const cleaned = localize(('<!DOCTYPE html>\n' + html.replace(/^<!DOCTYPE html>\s*/i, ''))
        .replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/gi, '')
        .replace(/<script\b[^>]*src="(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/[^"]*"[^>]*><\/script>\s*/gi, ''));
      fs.writeFileSync(out, cleaned, 'utf8');
    }
    done.push(p);
    await sleep(250);
  }

  await cdp.send('Browser.close').catch(() => {});
  edge.kill();

  fs.writeFileSync(path.join(__dirname, 'crawl-report.json'), JSON.stringify({ done, failed, links: Object.fromEntries(allLinks), seen: [...seen] }, null, 1));
  console.log(`\nXong: OK=${done.length}  HỎNG=${failed.length}  URL đã biết=${seen.size}  còn trong hàng đợi=${queue.length}`);
  if (failed.length) console.log('HỎNG: ' + failed.slice(0, 15).join(' | '));

  flushLog();
  const byMethod = {};
  for (const b of BLOCKED) byMethod[b.method] = (byMethod[b.method] || 0) + 1;
  console.log('\n── NETWORK GUARD ──');
  console.log('Request đã log: ' + SENT + '  |  chặn non-GET: ' + BLOCKED.length
    + (BLOCKED.length ? ' (' + Object.entries(byMethod).map(([k, v]) => k + '=' + v).join(', ') + ')' : ''));
  console.log('Log: ' + path.relative(path.join(__dirname, '..'), LOG_FILE));
  if (BLOCKED.length) console.log('Mẫu bị chặn: ' + BLOCKED.slice(0, 5).map(b => b.method + ' ' + (b.url.length > 100 ? b.url.slice(0, 100) + '…' : b.url)).join(' | '));
})().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
