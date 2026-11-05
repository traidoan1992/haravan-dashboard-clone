// Tải mọi asset (ảnh/svg/css/font) còn thiếu về thư mục assets/ — CHỈ GET
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const need = new Set();
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/([A-Za-z0-9._\-]+\.(?:png|jpe?g|svg|gif|webp|css|woff2?|ttf|ico))/g)) {
    if (!fs.existsSync(path.join(ROOT, 'assets', m[1]))) need.add(m[1]);
  }
}
console.log('Asset thiếu:', need.size);

const get = (p, depth = 0) => new Promise((res, rej) => {
  if (depth > 3) return rej(new Error('redirect'));
  https.get({ hostname: HOST, path: p, headers: { cookie: COOKIE_FILE ? fs.readFileSync(COOKIE_FILE, 'utf8').trim() : '', 'user-agent': 'Mozilla/5.0' } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, depth + 1).then(res, rej); }
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(chunks) }));
  }).on('error', rej);
});

(async () => {
  let ok = 0;
  for (const name of need) {
    try {
      const r = await get('/admin/assets/' + name);
      if (r.status === 200 && r.body.length > 50) {
        fs.writeFileSync(path.join(ROOT, 'assets', name), r.body);
        ok++; console.log('   OK   ' + name + '  ' + r.body.length + ' bytes');
      } else console.log('   HỎNG ' + name + ' status=' + r.status);
    } catch (e) { console.log('   LỖI  ' + name + ' ' + e.message); }
  }
  console.log('Đã tải: ' + ok + '/' + need.size);
})();
