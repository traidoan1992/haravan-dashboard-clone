// Phân tích URL tuyệt đối tới admin thật theo tiền tố đường dẫn + loại thuộc tính (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const byPrefix = {}, byAttr = {}, uniq = new Set();
const samples = {};
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/https?:\/\/noritake\.myharavan\.com(\/[^"'\s<>)\\]*)?/gi)) {
    const full = m[0];
    uniq.add(full);
    const p = (m[1] || '/').split('/').filter(Boolean)[0] || '/';
    byPrefix['/' + p] = (byPrefix['/' + p] || 0) + 1;
    const before = html.slice(Math.max(0, m.index - 24), m.index);
    const attr = (before.match(/([a-z-]+)="$/i) || [])[1] || 'other';
    byAttr[attr] = (byAttr[attr] || 0) + 1;
    if (!samples['/' + p]) samples['/' + p] = before.slice(-20) + full.slice(0, 80);
  }
}
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
console.log('Tổng lượt: ' + Object.values(byPrefix).reduce((a, b) => a + b, 0) + ' | unique: ' + uniq.size);
console.log('\n-- theo tiền tố --');
top(byPrefix).slice(0, 12).forEach(([k, v]) => console.log(String(v).padStart(7) + '  ' + k + '   vd: ' + samples[k]));
console.log('\n-- theo thuộc tính --');
top(byAttr).slice(0, 12).forEach(([k, v]) => console.log(String(v).padStart(7) + '  ' + k));
