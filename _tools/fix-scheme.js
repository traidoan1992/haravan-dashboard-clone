// Sửa URL thiếu scheme do lỗi localize: "noritake.myharavan.com/..." -> "https://noritake.myharavan.com/..."
// node _tools/fix-scheme.js [--apply]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let touched = 0, total = 0;
for (const f of files) {
  const full = path.join(ROOT, f);
  const src = fs.readFileSync(full, 'utf8');
  const matches = src.match(/="noritake\.myharavan\.com\//g) || [];
  if (!matches.length) continue;
  touched++;
  total += matches.length;
  if (APPLY) fs.writeFileSync(full, src.replace(/="noritake\.myharavan\.com\//g, '="https://noritake.myharavan.com/'), 'utf8');
}
console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ` — ${touched} file, ${total} URL thiếu scheme`);
