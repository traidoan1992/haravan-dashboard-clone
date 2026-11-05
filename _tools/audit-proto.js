// Xem mẫu các tham chiếu "//" (protocol-relative) và các giá trị lạ
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const proto = new Map(); const odd = [];
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/(?:href|src|action)="([^"]*)"/g)) {
    const raw = m[1];
    if (raw.startsWith('//')) { const h = raw.split('/')[2]; proto.set(h, (proto.get(h) || 0) + 1); }
    if (/^[^\w."'#/?]/.test(raw) || /^\s/.test(raw)) odd.push(f + ' → ' + JSON.stringify(raw.slice(0, 60)));
  }
}
console.log('Host của tham chiếu "//" (protocol-relative):');
[...proto.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log('   ' + String(n).padStart(5) + '  ' + h));
console.log('\nGiá trị lạ (' + odd.length + '):');
odd.slice(0, 5).forEach(o => console.log('   ' + o));
