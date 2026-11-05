// Tìm dấu vết route trong 1 file: mọi chuỗi chứa "/admin/"
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2];
const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
const set = new Map();
const re = /\/admin\/[A-Za-z0-9_\-\/{}:.]*/g;
let m;
while ((m = re.exec(t))) {
  const i = m.index;
  const ctx = t.slice(Math.max(0, i - 60), i + 90).replace(/\s+/g, ' ');
  const prev = set.get(m[0]);
  if (!prev) set.set(m[0], ctx);
}
console.log('FILE', f, 'len', t.length, 'distinct', set.size);
for (const [k, v] of set) console.log('  ' + k + '   <<< ' + v.slice(0, 140));
