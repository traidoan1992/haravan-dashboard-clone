// Quét (CHỈ ĐỌC) v2: ánh xạ URL -> tên file bằng cách đổi '/' thành '_'
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const HOST = 'https://noritake.myharavan.com';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileSet = new Set(files);

function fileForPath(p) {
  if (p === '/admin' || p === '/admin/') return 'index.html';
  let q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!q) return 'index.html';
  const cand = q.replace(/\//g, '_') + '.html';
  return fileSet.has(cand) ? cand : null;
}

const urls = new Map();
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /(?:href|src|action)="(https:\/\/noritake\.myharavan\.com[^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].replace(/&amp;/g, '&');
    const p = u.slice(HOST.length).split(/[?#]/)[0];
    if (/^\/admin\/assets\//.test(p) || /^\/admin\/ckeditor/.test(p)) continue;
    if (/\.(js|css|png|jpe?g|svg|woff2?|ttf|ico|json)$/i.test(p)) continue;
    urls.set(p, (urls.get(p) || 0) + 1);
  }
}

const all = [...urls.entries()].sort((a, b) => b[1] - a[1]);
const mapped = all.filter(([p]) => fileForPath(p));
const unmapped = all.filter(([p]) => !fileForPath(p));
console.log('URL trang khác nhau:', all.length, '| gắn được:', mapped.length, '| chưa:', unmapped.length);

const used = new Set(mapped.map(([p]) => fileForPath(p)));
used.add('404.html');
const orphans = files.filter(f => !used.has(f));
console.log('\nFile clone không khớp URL nào:', orphans.length);
orphans.forEach(f => console.log('   ' + f));

console.log('\nURL chưa có file (top 40):');
unmapped.slice(0, 40).forEach(([p, c]) => console.log(String(c).padStart(3) + '  ' + p));
