// Quét (CHỈ ĐỌC) toàn bộ HTML clone: tìm mọi URL noritake.myharavan.com và
// đối chiếu với file .html clone sẵn có để biết tỉ lệ "gắn được".
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const HOST = 'https://noritake.myharavan.com';

// --- bảng ánh xạ file -> đường dẫn thật trên admin ---
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileByUrl = new Map();
for (const f of files) {
  if (f === '404.html') continue;
  const url = f === 'index.html' ? '/admin'
    : f === 'index_1.html' ? '/admin/dashboard/generals'
    : '/admin/' + f.replace(/\.html$/, '').replace(/_/g, '/');
  if (!fileByUrl.has(url)) fileByUrl.set(url, f);
}

const stats = { urls: new Map(), assets: new Map() };
const HREF_RE = /(href|src|action)="(https:\/\/noritake\.myharavan\.com[^"]*)"/g;

for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m;
  while ((m = HREF_RE.exec(html))) {
    let u = m[2].replace(/&amp;/g, '&');
    const p = u.slice(HOST.length).split(/[?#]/)[0];
    const isAsset = /^\/admin\/assets\//.test(p) || /\.(js|css|png|jpe?g|svg|woff2?|ttf|ico)$/i.test(p);
    const bucket = isAsset ? stats.assets : stats.urls;
    bucket.set(p, (bucket.get(p) || 0) + 1);
  }
}

console.log('Số file HTML:', files.length);
console.log('URL trang (không phải asset) khác nhau:', stats.urls.size);
console.log('URL asset khác nhau:', stats.assets.size);

const pageUrls = [...stats.urls.entries()].sort((a, b) => b[1] - a[1]);
const mapped = pageUrls.filter(([p]) => fileByUrl.has(p));
const unmapped = pageUrls.filter(([p]) => !fileByUrl.has(p));
console.log('  ↳ có file clone:', mapped.length, '| chưa có:', unmapped.length);
console.log('\n-- CHƯA có file clone (top 40) --');
unmapped.slice(0, 40).forEach(([p, c]) => console.log(String(c).padStart(3) + '  ' + p));

console.log('\n-- File clone KHÔNG được link từ đâu (mồ côi) --');
const linked = new Set(mapped.map(([p]) => fileByUrl.get(p)));
const orphans = files.filter(f => f !== '404.html' && !linked.has(f));
console.log(orphans.length ? orphans.join('\n') : '(không có)');

console.log('\n-- Asset thiếu file local --');
const missingAssets = [...stats.assets.keys()].filter(p => {
  const local = path.join(ROOT, p.replace(/^\/admin\//, '/'));
  return !fs.existsSync(local);
});
console.log('tổng asset thiếu:', missingAssets.length);
missingAssets.slice(0, 20).forEach(p => console.log('   ' + p));
