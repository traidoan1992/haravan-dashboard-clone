// Xem dạng href/src trong 1 file (để biết cần rewrite dạng nào)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2];
const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
const all = [...t.matchAll(/(?:href|src|action)="([^"]+)"/g)].map(m => m[1]);
const groups = { host: 0, rootAdmin: 0, relFile: 0, other: 0 };
for (const u of all) {
  if (/^https:\/\/noritake\.myharavan\.com/.test(u)) groups.host++;
  else if (u.startsWith('/admin/') || u === '/admin') groups.rootAdmin++;
  else if (/^[a-z0-9_\-]+\.html$/i.test(u)) groups.relFile++;
  else groups.other++;
}
console.log(f, 'tổng', all.length, JSON.stringify(groups));
console.log('mẫu:');
[...new Set(all)].slice(0, 15).forEach(u => console.log('   ' + u.slice(0, 120)));
