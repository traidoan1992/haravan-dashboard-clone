// Tìm trang "vỏ rỗng": chỉ có khung menu, nội dung chính không render khi chụp
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const rows = [];
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((t.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  // lấy phần giữa breadcrumb và footer để đo "nội dung chính"
  const body = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const text = body.replace(/\s+/g, ' ').trim();
  // trừ đi phần chrome chung (~ menu trái + header)
  const main = text.length;
  rows.push({ f, title, textLen: main, tags: (t.match(/<tr\b/g) || []).length });
}
rows.sort((a, b) => a.textLen - b.textLen);
console.log('10 trang ít chữ nhất (nghi là vỏ rỗng):');
rows.slice(0, 12).forEach(r => console.log('  ' + String(r.textLen).padStart(6) + ' ký tự, ' + String(r.tags).padStart(3) + ' row  ' + r.f + '   ' + r.title));
