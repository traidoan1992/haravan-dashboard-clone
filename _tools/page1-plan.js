// Lập kế hoạch "trang 1": chỉ lấy link chi tiết NẰM TRONG trang danh sách (trang 1), KHÔNG phân trang
// node _tools/page1-plan.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');

// trang danh sách (trang 1) -> mẫu URL chi tiết được phép lấy
const LISTS = [
  ['orders.html', [/^\/admin\/orders\/\d+$/]],
  ['draft_orders.html', [/^\/admin\/draft_orders\/[0-9a-f]{20,}$/]],
  ['products.html', [/^\/admin\/products\/\d+$/]],
  ['products_collections.html', [/^\/admin\/products\/collections\/\d+$/]],
  ['customers.html', [/^\/admin\/customers\/\d+$/]],
  ['inventory_transactions.html', [/^\/admin\/inventory\/[a-z_]+\/\d+$/]],
  ['inventory_inventory_receives.html', [/^\/admin\/inventory\/inventory_receives\/\d+$/]],
  ['inventory_purchase_returns.html', [/^\/admin\/inventory\/purchase_returns\/\d+$/]],
  ['inventory_stock_takes.html', [/^\/admin\/inventory\/stock_takes\/\d+$/]],
  ['inventory_transfers.html', [/^\/admin\/inventory\/transfers\/\d+$/]],
  ['inventory_purchasing_orders.html', [/^\/admin\/inventory\/purchasing_orders\/\d+$/]],
  ['accounting_transactions.html', [/^\/admin\/accounting\/transactions\/\d+$/]],
  ['accounting_debts.html', [/^\/admin\/accounting\/transactions\/\d+$/]],
  ['discounts.html', [/^\/admin\/discounts\/\d+$/]]
];

const SPECIAL = { '/admin': 'index.html', '/admin/dashboard/generals': 'index.html' };
const fileFor = p => {
  if (SPECIAL[p]) return SPECIAL[p];
  const q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  return (q ? q.replace(/\//g, '_') : 'index') + '.html';
};

const plan = [];
const seen = new Set();
const summary = [];

for (const [listFile, patterns] of LISTS) {
  const full = path.join(ROOT, listFile);
  if (!fs.existsSync(full)) { summary.push([listFile, 'THIẾU TRANG DANH SÁCH', 0, 0]); continue; }
  const t = fs.readFileSync(full, 'utf8');
  const found = new Set();
  let cloned = 0;
  for (const m of t.matchAll(/(?:href|src)="(?:https?:\/\/noritake\.myharavan\.com)?(\/admin\/[^"?#]*)/g)) {
    const p = m[1].replace(/\/+$/, '');
    if (!patterns.some(re => re.test(p))) continue;
    if (fs.existsSync(path.join(ROOT, fileFor(p)))) { cloned++; continue; }
    found.add(p);
  }
  for (const p of found) if (!seen.has(p)) { seen.add(p); plan.push(p); }
  summary.push([listFile, '', found.size, cloned]);
}

fs.writeFileSync(path.join(__dirname, 'page1-urls.json'), JSON.stringify(plan, null, 1));
console.log('Trang danh sách'.padEnd(40) + 'cần crawl'.padStart(11) + 'đã có'.padStart(8));
for (const [f, note, need, have] of summary) {
  console.log(f.padEnd(40) + String(need).padStart(11) + String(have).padStart(8) + (note ? '  ' + note : ''));
}
console.log('-'.repeat(60));
console.log('TỔNG cần crawl (trang 1, không phân trang): ' + plan.length + ' trang');
console.log('~thời gian: ' + Math.round(plan.length * 2 / 60) + ' phút');
