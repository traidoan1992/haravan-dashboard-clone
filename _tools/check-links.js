// Kiểm tra: link nội bộ hỏng + trang clone không thể tới được từ index.html
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileSet = new Set(files);

const graph = new Map();
const broken = new Map();

for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const out = new Set();
  const re = /(?:href|src|action)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].split('#')[0].split('?')[0];
    if (!u || /^(https?:|data:|mailto:|javascript:|tel:|\/\/)/i.test(u)) continue;
    const target = u.replace(/^\.\//, '');
    if (target.endsWith('.html')) {
      if (fileSet.has(target)) out.add(target);
      else broken.set(target, (broken.get(target) || 0) + 1);
    } else if (!target.includes('/')) {
      if (!fs.existsSync(path.join(ROOT, target))) broken.set(target, (broken.get(target) || 0) + 1);
    }
  }
  graph.set(f, out);
}

// BFS
const seen = new Set(['index.html']);
const q = ['index.html'];
while (q.length) {
  const cur = q.shift();
  for (const n of graph.get(cur) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
}

const unreachable = files.filter(f => !seen.has(f) && f !== '404.html');
console.log('File HTML:', files.length, '| tới được từ index.html:', seen.size, '| KHÔNG tới được:', unreachable.length);
const incoming = new Map();
for (const [from, to] of graph) for (const t of to) incoming.set(t, (incoming.get(t) || []).concat(from));
console.log('\n-- Trang không có link nào trỏ tới (mồ côi hoàn toàn) --');
files.filter(f => !incoming.has(f) && f !== '404.html').forEach(f => console.log('   ' + f));
console.log('\n-- Không tới được từ index.html --');
unreachable.forEach(f => console.log('   ' + f + '   ← ' + ((incoming.get(f) || []).slice(0, 4).join(', ') || 'không ai trỏ tới')));
console.log('\n-- Link nội bộ hỏng --');
if (!broken.size) console.log('   (không có)');
[...broken.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log('   ' + String(c).padStart(3) + '  ' + t));
