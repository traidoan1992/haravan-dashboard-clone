// Theo dõi 1 trang: in "dấu vân tay" DOM mỗi giây để biết khi nào nội dung thật sự tải xong
// node _tools/probe-page.js /admin/customers 25
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';
const PORT = 9335;
const target = process.argv[2] || '/admin/customers';
const seconds = Number(process.argv[3] || 25);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = url => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));

function parseCookies(str) {
  return str.split(/;\s*/).filter(Boolean).map(p => { const i = p.indexOf('='); return { name: p.slice(0, i).trim(), value: p.slice(i + 1), domain: '.' + HOST, path: '/', secure: true }; }).filter(c => c.name);
}

(async () => {
  const profile = path.join(os.tmpdir(), 'edge-probe-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60; i++) { try { ws = (await jget(`http://127.0.0.1:${PORT}/json/version`)).webSocketDebuggerUrl; break; } catch { await sleep(400); } }
  const sock = new WebSocket(ws);
  await new Promise(r => (sock.onopen = r));
  let id = 0; const pending = new Map(); const events = [];
  sock.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method) events.push(m); };
  const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; sock.send(JSON.stringify(msg)); return new Promise((res, rej) => pending.set(i, { res, rej })); };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Network.setCookies', { cookies: parseCookies(fs.readFileSync(COOKIE_FILE, 'utf8')) }, sessionId);

  await send('Page.navigate', { url: 'https://' + HOST + target }, sessionId);
  for (let s = 1; s <= seconds; s++) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', {
      expression: 'JSON.stringify({len:document.documentElement.outerHTML.length,tr:document.querySelectorAll("tr").length,a:document.querySelectorAll("a[href]").length,txt:document.body.innerText.length,res:performance.getEntriesByType("resource").length,t:document.title})',
      returnByValue: true
    }, sessionId);
    console.log('t=' + String(s).padStart(2) + 's  ' + r.result.value);
    if (s === seconds) {
      const bad = events.filter(e => (e.method === 'Network.responseReceived' && e.params.response.status >= 400)
        || e.method === 'Network.loadingFailed'
        || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
      console.log('--- sự kiện lỗi (' + bad.length + '):');
      bad.slice(0, 20).forEach(e => {
        if (e.method === 'Network.responseReceived') console.log('   HTTP ' + e.params.response.status + '  ' + e.params.response.url.slice(0, 120));
        else if (e.method === 'Network.loadingFailed') console.log('   FAIL  ' + (e.params.errorText || '') + '  ' + (e.params.requestId || ''));
        else console.log('   CONSOLE ' + JSON.stringify(e.params.args && e.params.args.map(a => a.value || a.description || '')).slice(0, 200));
      });
      const urls = events.filter(e => e.method === 'Network.requestWillBeSent')
        .map(e => e.params.request.method + ' ' + e.params.request.url)
        .filter(u => !/\.(js|css|woff2?|png|jpe?g|svg|ico)(\?|$)/.test(u));
      console.log('--- request không phải asset (' + urls.length + '):');
      [...new Set(urls)].slice(0, 25).forEach(u => console.log('   ' + u.slice(0, 150)));
      const ifr = await send('Runtime.evaluate', { expression: 'JSON.stringify([...document.querySelectorAll("iframe")].map(f=>f.getAttribute("src")||"(no src)"))', returnByValue: true }, sessionId);
      console.log('--- iframe: ' + ifr.result.value);
    }
  }
  await send('Browser.close').catch(() => {});
  edge.kill();
})();
