// Chèn assets/clone-nav.js vào cuối mọi trang clone (idempotent)
// node _tools/inject-nav.js [--apply]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');
const TAG = '<script src="assets/clone-nav.js"></script>';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let added = 0, already = 0, noBody = 0;
for (const f of files) {
  const full = path.join(ROOT, f);
  const src = fs.readFileSync(full, 'utf8');
  if (src.includes('clone-nav.js')) { already++; continue; }
  const i = src.lastIndexOf('</body>');
  if (i < 0) { noBody++; continue; }
  const out = src.slice(0, i) + TAG + '\n' + src.slice(i);
  added++;
  if (APPLY) fs.writeFileSync(full, out, 'utf8');
}
console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ` — thêm: ${added} | đã có: ${already} | không có </body>: ${noBody}`);
