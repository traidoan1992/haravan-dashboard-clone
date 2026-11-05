// Liệt kê asset được tham chiếu nhưng chưa có file local, tách theo loại
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const missing = new Map(); // name -> {ext, count, files:Set}
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/(?:https:\/\/noritake\.myharavan\.com)?\/admin\/assets\/([A-Za-z0-9._\-]+)/g)) {
    const name = m[1];
    if (fs.existsSync(path.join(ROOT, 'assets', name))) continue;
    if (!missing.has(name)) missing.set(name, { ext: path.extname(name).toLowerCase(), files: new Set() });
    missing.get(name).files.add(f);
  }
}
const byExt = {};
for (const [, v] of missing) byExt[v.ext] = (byExt[v.ext] || 0) + 1;
console.log('asset thiếu:', missing.size, JSON.stringify(byExt));
[...missing.entries()].slice(0, 25).forEach(([n, v]) => console.log('   ' + n + '   (' + v.files.size + ' trang)'));
