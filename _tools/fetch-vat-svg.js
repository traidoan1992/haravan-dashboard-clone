// Tải 3 SVG còn thiếu cho trang Thuế (relative "assets/svg/...") — CHỈ GET
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';

const names = ['vat-guide-1.svg', 'vat-guide-2.svg', 'vat-guide-3.svg'];
const dir = path.join(ROOT, 'assets', 'svg');
fs.mkdirSync(dir, { recursive: true });

const get = p => new Promise((res, rej) => https.get({ hostname: HOST, path: p, headers: { cookie: fs.readFileSync(COOKIE_FILE, 'utf8').trim(), 'user-agent': 'Mozilla/5.0' } }, r => {
  const c = []; r.on('data', x => c.push(x)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c) }));
}).on('error', rej));

(async () => {
  for (const n of names) {
    const r = await get('/admin/assets/svg/' + n);
    if (r.status === 200 && r.body.length > 50) {
      fs.writeFileSync(path.join(dir, n), r.body);
      console.log('OK   ' + n + '  ' + r.body.length + ' bytes');
    } else console.log('HỎNG ' + n + ' status=' + r.status + ' len=' + r.body.length);
  }
})();
