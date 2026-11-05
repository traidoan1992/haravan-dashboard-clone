// Lấy nội dung app NHÚNG IFRAME (customers.haravan.app / reports.haravan.app):
// 1) render trang admin để lấy URL iframe có hmac  2) render URL đó, lấy DOM + đo nội dung
// node _tools/probe-iframe.js /admin/customers
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';
const PORT = 9336;
const target = process.argv[2] || '/admin/customers';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = url => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const parseCookies = str => str.split(/;\s*/).filter(Boolean).map(p => { const i = p.indexOf('='); return { name: p.slice(0, i).trim(), value: p.slice(i + 1), domain: '.' + HOST, path: '/', secure: true }; }).filter(c => c.name);

(async () => {
  const profile = path.join(os.tmpdir(), 'edge-ifr-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60; i++) { try { ws = (await jget(`http://127.0.0.1:${PORT}/json/version`)).webSocketDebuggerUrl; break; } catch { await sleep(400); } }
  const sock = new WebSocket(ws);
  await new Promise(r => (sock.onopen = r));
  let id = 0; const pending = new Map();
  sock.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; sock.send(JSON.stringify(msg)); return new Promise((res, rej) => pending.set(i, { res, rej })); };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Network.setCookies', { cookies: parseCookies(fs.readFileSync(COOKIE_FILE, 'utf8')) }, sessionId);

  const evalIn = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;

  // 1) trang admin -> lấy src iframe
  await send('Page.navigate', { url: 'https://' + HOST + target }, sessionId);
  await sleep(6000);
  const iframeSrc = await evalIn('(document.querySelector(\'iframe[src*="haravan.app"]\')||{}).src || ""');
  console.log('iframe src:', iframeSrc.slice(0, 90) + '…');

  // 2) render app
  if (iframeSrc) {
    await send('Page.navigate', { url: iframeSrc }, sessionId);
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const info = await evalIn('JSON.stringify({len:document.documentElement.outerHTML.length,txt:document.body.innerText.length,t:document.title})');
      console.log('t=' + (i + 1) + 's ' + info);
      const o = JSON.parse(info);
      if (o.txt > 500) break;
    }
    const html = await evalIn('document.documentElement.outerHTML');
    fs.writeFileSync(path.join(__dirname, 'iframe-sample.html'), html, 'utf8');
    console.log('Đã lưu mẫu vào _tools/iframe-sample.html (' + html.length + ' bytes)');
  }
  await send('Browser.close').catch(() => {});
  edge.kill();
})();
