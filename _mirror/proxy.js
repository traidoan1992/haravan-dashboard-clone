const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const UP = 'https://noritake.myharavan.com';
const HOST = 'noritake.myharavan.com';
const PORT = 8123;
const cookieFile = ['cookie.txt', 'cookies.txt']
  .map(f => path.join(__dirname, f))
  .find(f => fs.existsSync(f));
if (!cookieFile) {
  console.error('Thiếu _mirror/cookie.txt — đăng nhập haravan rồi cập nhật file này.');
  process.exit(1);
}
const cookie = fs.readFileSync(cookieFile, 'utf8').trim();

// SAFETY: true = block ALL state-changing requests (POST/PUT/PATCH/DELETE).
// Quy tắc dự án: KHÔNG BAO GIỜ đặt false.
const READ_ONLY = true;
// Quy tắc dự án: KHÔNG có whitelist method. Mọi request không phải GET/HEAD/OPTIONS đều bị chặn.
const ALLOW_POST_PREFIXES = [];

// Log mọi request: [GET] <url> / [BLOCKED] <method> <url>
const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const LOG_FILE = path.join(__dirname, 'net-' + DAY + '.log');
let buf = [];
const flush = () => { if (!buf.length) return; try { fs.appendFileSync(LOG_FILE, buf.join('\n') + '\n'); } catch (e) {} buf = []; };
const netLog = line => { buf.push(line); if (buf.length >= 200) flush(); };
const counts = {};
const count = m => { counts[m] = (counts[m] || 0) + 1; };
process.on('exit', flush);

const server = http.createServer((req, res) => {
  count(req.method);
  const isWrite = READ_ONLY && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !ALLOW_POST_PREFIXES.some(p => req.url.startsWith(p));
  if (isWrite) {
    netLog('[BLOCKED] ' + req.method + ' ' + req.url);
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: 'READ-ONLY mirror: request blocked', method: req.method, path: req.url }));
    return;
  }
  netLog('[' + req.method + '] ' + req.url);
  const headers = Object.assign({}, req.headers);
  headers.host = HOST;
  headers.origin = UP;
  headers.referer = UP + req.url;
  headers.cookie = cookie;
  delete headers['accept-encoding'];
  delete headers['connection'];
  delete headers['proxy-connection'];
  delete headers['expect'];

  const opts = { method: req.method, hostname: HOST, path: req.url, headers, servername: HOST };
  const pr = https.request(opts, (up) => {
    const h = Object.assign({}, up.headers);
    if (h.location) {
      h.location = String(h.location).replace(/^https?:\/\/noritake\.myharavan\.com/i, '');
      if (!h.location.startsWith('/')) h.location = '/' + h.location;
    }
    delete h['content-security-policy'];
    delete h['content-security-policy-report-only'];
    delete h['x-frame-options'];
    delete h['strict-transport-security'];
    delete h['cross-origin-opener-policy'];
    delete h['cross-origin-embedder-policy'];
    delete h['permissions-policy'];
    res.writeHead(up.statusCode, h);
    up.pipe(res);
  });
  pr.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('MIRROR PROXY ERROR: ' + e.message);
  });
  req.pipe(pr);
});

// basic websocket/upgrade passthrough
server.on('upgrade', (req, socket, head) => {
  const headers = Object.assign({}, req.headers);
  headers.host = HOST; headers.cookie = cookie; headers.origin = UP;
  const pr = https.request({ hostname: HOST, port: 443, path: req.url, method: req.method, headers });
  pr.on('upgrade', (upRes, upSocket, upHead) => {
    const lines = ['HTTP/1.1 101 Switching Protocols'];
    for (const [k, v] of Object.entries(upRes.headers)) lines.push(k + ': ' + v);
    socket.write(lines.join('\r\n') + '\r\n\r\n');
    if (upHead && upHead.length) socket.write(upHead);
    upSocket.pipe(socket); socket.pipe(upSocket);
  });
  pr.on('error', () => socket.destroy());
  pr.end();
});

server.listen(PORT, '127.0.0.1', () => console.log('MIRROR running: http://127.0.0.1:' + PORT + '/admin/dashboard/generals'));
process.on('exit', () => console.log('Tổng request theo method: ' + JSON.stringify(counts) + ' | log: net-' + DAY + '.log'));
