// Kiểm toán điều hướng toàn bộ clone: link nào hỏng / trỏ ra ngoài
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileSet = new Set(files);

const missingTargets = new Map(); // target -> số link
const rootPaths = new Map();
let pagesWithBroken = 0;
const perPage = [];

for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let broken = 0, root = 0;
  for (const m of t.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:|javascript:|#|data:)/.test(h)) continue;
    if (h.startsWith('/')) { root++; rootPaths.set(h.split('?')[0], (rootPaths.get(h.split('?')[0]) || 0) + 1); continue; }
    const clean = h.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (clean.endsWith('.html') && !fileSet.has(clean)) {
      missingTargets.set(clean, (missingTargets.get(clean) || 0) + 1);
      broken++;
    }
  }
  if (broken) { pagesWithBroken++; perPage.push([f, broken]); }
}

console.log('Trang có link nội bộ HỎNG:', pagesWithBroken, '/', files.length);
console.log('Đích thiếu (khác nhau):', missingTargets.size, '| tổng link:', [...missingTargets.values()].reduce((a, b) => a + b, 0));
[...missingTargets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, n]) => console.log('   ' + String(n).padStart(4) + '  ' + t));
console.log('\nLink dạng "/..." (trỏ gốc, không tồn tại trên clone):', rootPaths.size);
[...rootPaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([t, n]) => console.log('   ' + String(n).padStart(4) + '  ' + t));
console.log('\nTrang hỏng nhiều nhất:');
perPage.sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([f, n]) => console.log('   ' + String(n).padStart(4) + '  ' + f));
