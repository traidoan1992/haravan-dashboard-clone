// Đếm attribute href/src/action còn trỏ tuyệt đối tới noritake
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
let total = 0;
const rows = [];
for (const f of fs.readdirSync(ROOT).filter(x => x.endsWith('.html'))) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const m = t.match(/(?:href|src|action)="https:\/\/noritake\.myharavan\.com[^"]*"/g) || [];
  if (m.length) { total += m.length; rows.push([f, m.length, m[0].slice(0, 70)]); }
}
rows.sort((a, b) => b[1] - a[1]);
console.log('Tổng attribute tuyệt đối còn lại:', total, '| số file:', rows.length);
rows.slice(0, 12).forEach(r => console.log('  ' + String(r[1]).padStart(3) + '  ' + r[0] + '   vd: ' + r[2]));
