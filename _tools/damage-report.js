// Thống kê mức độ "link dòng bị trỏ đồng loạt về 1 file" (di chứng của lần rewrite trước)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const DETAIL = /^(orders_\d+|products_\d+|shipments_\d+|customers_\d+|discounts_\d+|products_collections_\d+|draft_orders_[0-9a-f]+)\.html$/;

let totalBad = 0; const rows = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const counts = new Map();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (!DETAIL.test(h)) continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  const bad = [...counts.entries()].filter(([, c]) => c >= 5);
  if (bad.length) {
    const n = bad.reduce((s, [, c]) => s + c, 0);
    totalBad += n;
    rows.push([f, n, bad.map(([h, c]) => `${h}×${c}`).join(', ')]);
  }
}
rows.sort((a, b) => b[1] - a[1]);
console.log('File bị trỏ đồng loạt (>=5 link cùng 1 trang chi tiết):', rows.length, '| tổng link nghi sai:', totalBad);
rows.slice(0, 12).forEach(r => console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0] + '  ← ' + r[2].slice(0, 90)));
