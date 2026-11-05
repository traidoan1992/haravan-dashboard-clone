// In text thô (đã bỏ script/style/tag) của một file clone để đọc nội dung trang
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2];
let t = fs.readFileSync(path.join(ROOT, f), 'utf8');
t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');
const lines = t.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const seen = new Set();
const out = [];
for (const l of lines) { if (l.length > 1 && !seen.has(l)) { seen.add(l); out.push(l); } }
console.log(out.slice(0, Number(process.argv[3] || 60)).join(' | '));
