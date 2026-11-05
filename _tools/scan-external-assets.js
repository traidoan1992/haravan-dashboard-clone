// Đếm tài nguyên còn trỏ ra Internet (cần tải về để offline) — chỉ đọc.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const groups = {
  'noritake /admin/assets': /https?:\/\/noritake\.myharavan\.com\/admin\/assets\/[^"'\s)]+/gi,
  'hstatic (protocol-relative)': /\/\/(?:cdn|product|file)\.hstatic\.net\/[^"'\s)]+/gi,
  'haravan.app assets': /https?:\/\/[a-z0-9.-]+haravan\.(?:app|com)\/[^"'\s)]+\.(?:js|css|png|jpg|svg)/gi
};
for (const [label, re] of Object.entries(groups)) {
  const uniq = new Set();
  let n = 0, pages = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const hits = html.match(re) || [];
    if (hits.length) pages++;
    n += hits.length;
    hits.forEach(h => uniq.add(h));
  }
  console.log(label.padEnd(30) + 'lượt=' + String(n).padStart(6) + '  unique=' + String(uniq.size).padStart(5) + '  trang=' + pages);
  [...uniq].slice(0, 3).forEach(u => console.log('      ' + u.slice(0, 100)));
}
