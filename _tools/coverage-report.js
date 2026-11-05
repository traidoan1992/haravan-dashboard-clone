// Báo cáo độ phủ clone theo mô-đun + chất lượng trang
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const MODULES = [
  ['Tổng quan', /^index/],
  ['Đơn hàng', /^orders_|^orders\.html$/],
  ['Đơn nháp', /^draft_orders/],
  ['Sản phẩm', /^products/],
  ['Khách hàng', /^customers/],
  ['Tồn kho', /^inventory/],
  ['Sổ quỹ', /^accounting/],
  ['Khuyến mãi', /^discounts/],
  ['Báo cáo', /^reports/],
  ['Vận chuyển', /^shipments/],
  ['Cấu hình', /^settings/],
  ['Kênh bán hàng', /^sale_channels/],
  ['Marketing', /^marketings/],
  ['Google/Ứng dụng', /^googleshop|^apps/],
  ['Khác/404', /./]
];

const rows = MODULES.map(([name]) => ({ name, n: 0, shell: 0, is404: 0, noHref: 0 }));
const assign = f => {
  for (let i = 0; i < MODULES.length; i++) if (MODULES[i][1].test(f)) return i;
  return MODULES.length - 1;
};
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((t.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const text = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const r = rows[assign(f)];
  r.n++;
  if (text.length < 1200) r.shell++;
  if (/Lỗi 404/.test(title)) r.is404++;
  r.noHref += (t.match(/<a\b(?![^>]*\bhref=)[^>]*>/g) || []).length;
}
console.log('Tổng file HTML:', files.length);
console.log('Mô-đun'.padEnd(18) + 'trang'.padStart(7) + 'ít chữ'.padStart(9) + '404'.padStart(7) + '  <a> thiếu href'.padStart(16));
for (const r of rows) {
  if (!r.n) continue;
  console.log(r.name.padEnd(18) + String(r.n).padStart(7) + String(r.shell).padStart(9) + String(r.is404).padStart(7) + String(r.noHref).padStart(16));
}
const rep = path.join(__dirname, 'crawl-report.json');
if (fs.existsSync(rep)) {
  const j = JSON.parse(fs.readFileSync(rep, 'utf8'));
  console.log('\ncrawl-report: OK=' + j.done.length + ' HỎNG=' + j.failed.length + ' URL đã biết=' + j.seen.length);
  if (j.failed.length) console.log('  hỏng: ' + j.failed.slice(0, 10).join(', '));
}
