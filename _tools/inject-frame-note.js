// Chèn assets/clone-frame-note.js vào các trang có iframe app (idempotent)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');
const TAG = '<script src="assets/clone-frame-note.js"></script>';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let added = 0, skipped = 0;
for (const f of files) {
  const full = path.join(ROOT, f);
  let t = fs.readFileSync(full, 'utf8');
  if (!/iframe[^>]+src="https:\/\/(customers|reports)\.haravan\.app/.test(t)) continue;
  if (t.includes('clone-frame-note.js')) { skipped++; continue; }
  const i = t.lastIndexOf('</body>');
  if (i < 0) continue;
  t = t.slice(0, i) + TAG + '\n' + t.slice(i);
  added++;
  if (APPLY) fs.writeFileSync(full, t, 'utf8');
}
console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ` — thêm: ${added} | đã có: ${skipped}`);
