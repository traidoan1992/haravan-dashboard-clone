// Danh sách trang "vỏ rỗng" (nội dung chính gần như không có) + gợi ý URL thật
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== '404.html');

const out = [];
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((t.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const text = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 1200) out.push({ f, len: text.length, title });
}
out.sort((a, b) => a.len - b.len);
console.log('Trang vỏ rỗng:', out.length + '/' + files.length);
out.forEach(r => console.log('  ' + String(r.len).padStart(5) + '  ' + r.f.padEnd(44) + r.title));
