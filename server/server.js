// Máy chủ HTML TĨNH — không Node module ngoài, không MongoDB, không API.
// Chạy: node server/server.js   →  http://127.0.0.1:3100/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const PORT = Number(process.env.PORT || 3100);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  // ---- CÔNG CỤ TẠM (chỉ bật khi CAPTURE=1): dùng để chụp HTML từ site thật ----
  if (process.env.CAPTURE === '1') {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/__map') {
      const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
      const map = [];
      for (const f of files) {
        if (f === '404.html' || f === 'index_1.html' || f === 'reports_dashboard.html') continue;
        const url = f === 'index.html' ? '/admin' : '/admin/' + f.replace(/\.html$/, '').replace(/_/g, '/');
        map.push({ file: f, url });
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(map));
    }
    if (u.pathname === '/__save' && req.method === 'POST') {
      const name = u.searchParams.get('name') || 'reports_dashboard.html';
      if (!/^[a-z0-9_\-]+\.html$/i.test(name)) {
        res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
        return res.end('bad name');
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (c) => { body += c; if (body.length > 60 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        fs.writeFileSync(path.join(ROOT, name), body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('saved ' + name + ' ' + body.length);
      });
      return;
    }
    if (u.pathname.startsWith('/__')) {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end(req.method === 'OPTIONS' ? '' : 'ok');
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Chỉ hỗ trợ GET/HEAD');
  }

  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'URL không hợp lệ');
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      nf(res, rel);
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });

  function nf(res2, relPath) {
    // thử thêm .html nếu người dùng gõ thiếu đuôi
    if (!path.extname(relPath)) {
      const alt = path.join(ROOT, relPath + '.html');
      if (fs.existsSync(alt)) {
        res.writeHead(302, { Location: relPath + '.html' });
        return res.end();
      }
    }
    const p404 = path.join(ROOT, '404.html');
    if (fs.existsSync(p404)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.createReadStream(p404).pipe(res);
    }
    send(res2, 404, 'Không tìm thấy: ' + relPath);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('STATIC SERVER: http://127.0.0.1:' + PORT + '/  →  ' + ROOT);
});
