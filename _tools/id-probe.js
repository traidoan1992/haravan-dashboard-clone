// Tìm dấu vết ID sản phẩm trong một trang để có thể khôi phục link thật
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2];
const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
const nums = new Map();
for (const m of t.matchAll(/\b(1[0-9]{9})\b/g)) nums.set(m[1], (nums.get(m[1]) || 0) + 1);
console.log('file', f, 'len', t.length);
console.log('số 10 chữ số khác nhau:', nums.size);
const top = [...nums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('phổ biến:', JSON.stringify(top));
// ngữ cảnh quanh một ID
if (top.length) {
  const id = top[0][0];
  const i = t.indexOf(id);
  console.log('ctx:', t.slice(Math.max(0, i - 160), i + 160).replace(/\s+/g, ' '));
}
