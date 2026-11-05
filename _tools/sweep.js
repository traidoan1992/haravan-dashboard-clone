// Quét nhanh: URL thiếu scheme, ref /admin/, CSS/JS không local
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let noScheme = 0, rootRef = 0, absRef = 0;
const bad = [];
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const a = (t.match(/="noritake\.myharavan\.com\//g) || []).length;
  const b = (t.match(/(?:href|src)="\/admin\//g) || []).length;
  const c = (t.match(/(?:href|src)="https:\/\/noritake\.myharavan\.com\/admin\/assets\/[^"]+\.(?:css|js)"/g) || []).length;
  noScheme += a; rootRef += b; absRef += c;
  if (a || b) bad.push(f + ` (scheme:${a} root:${b})`);
}
console.log(`Files: ${files.length} | URL thiếu scheme: ${noScheme} | ref "/admin/": ${rootRef} | asset tuyệt đối: ${absRef}`);
if (bad.length) { console.log('Còn vấn đề:'); bad.slice(0, 10).forEach(x => console.log('   ' + x)); }
