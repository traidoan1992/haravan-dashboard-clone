// Hoàn tất các trang vừa chụp bằng trình duyệt:
//  - bỏ <link rel="modulepreload"> / <script src> trỏ tới bundle JS của site (clone không chạy SPA)
//  - tải các file .css/.woff2 còn thiếu về assets/ (CHỈ GET)
// Chạy: node _tools/localize-new.js [--apply]
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')].find(p => fs.existsSync(p));
const HOST = 'noritake.myharavan.com';
const APPLY = process.argv.includes('--apply');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

function get(pathname, depth = 0) {
  return new Promise((res, rej) => {
    if (depth > 3) return rej(new Error('redirect'));
    https.get({ hostname: HOST, path: pathname, headers: { cookie: COOKIE_FILE ? fs.readFileSync(COOKIE_FILE, 'utf8').trim() : '', 'user-agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, depth + 1).then(res, rej); }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', rej);
  });
}

(async () => {
  let stripped = 0, changedFiles = 0;
  const need = new Map(); // name -> true (chỉ css/font)

  for (const f of files) {
    const full = path.join(ROOT, f);
    const src = fs.readFileSync(full, 'utf8');
    let out = src;

    // 1) bỏ preload/script bundle JS của site
    out = out.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/gi, () => { stripped++; return ''; });
    out = out.replace(/<script\b[^>]*src="(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/[^"]*"[^>]*><\/script>\s*/gi, () => { stripped++; return ''; });

    // 2) ghi nhận css/font còn thiếu
    for (const m of out.matchAll(/(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/([A-Za-z0-9._\-]+\.(?:css|woff2?|ttf))/g)) {
      const name = m[1];
      if (!fs.existsSync(path.join(ROOT, 'assets', name))) need.set(name, true);
    }

    if (out !== src) {
      changedFiles++;
      if (APPLY) fs.writeFileSync(full, out, 'utf8');
    }
  }
  console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ` — bỏ ${stripped} thẻ preload/script, ${changedFiles} file đổi; css/font thiếu: ${need.size}`);

  if (!APPLY || !need.size) return;
  let got = 0;
  for (const name of need.keys()) {
    try {
      const r = await get('/admin/assets/' + name);
      if (r.status === 200 && r.body.length > 100) {
        fs.writeFileSync(path.join(ROOT, 'assets', name), r.body);
        got++;
        console.log('   tải ' + name + '  ' + r.body.length + ' bytes');
      } else console.log('   HỎNG ' + name + ' status=' + r.status);
    } catch (e) { console.log('   LỖI ' + name + ' ' + e.message); }
  }
  console.log('Đã tải: ' + got + '/' + need.size);
})();
