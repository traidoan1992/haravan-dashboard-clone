// Báo cáo CHỈ 8 module người dùng yêu cầu
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const MODULES = [
  ['1. dashboard/generals', /^index(_1)?\.html$/],
  ['2. orders', /^orders/],
  ['3. products', /^products/],
  ['4. customers', /^customers/],
  ['5. inventory', /^inventory/],
  ['6. accounting', /^accounting/],
  ['7. discounts', /^discounts/],
  ['8. reports', /^reports/]
];

const res = MODULES.map(([name, re]) => ({ name, n: 0, ok: 0, thin: [], wrap: 0 }));
for (const f of files) {
  const i = MODULES.findIndex(([, re]) => re.test(f));
  if (i < 0) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((t.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const tr = (t.match(/<tr\b/g) || []).length;
  const text = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().length;
  const wrap = /<iframe[^>]*src="https:\/\/(customers|reports)\.haravan\.app/i.test(t);
  const r = res[i];
  r.n++;
  if (wrap) { r.wrap++; r.ok++; continue; }
  if (/Lỗi 404/.test(title)) { r.thin.push(f + ' [404]'); continue; }
  if (tr > 0 || text >= 1200) r.ok++;
  else r.thin.push(f);
}

let total = 0, okTotal = 0;
console.log('Module'.padEnd(22) + 'trang'.padStart(6) + 'có nội dung'.padStart(12) + 'iframe'.padStart(8) + '  mỏng');
for (const r of res) {
  total += r.n; okTotal += r.ok;
  console.log(r.name.padEnd(22) + String(r.n).padStart(6) + String(r.ok).padStart(12) + String(r.wrap).padStart(8) + '  ' + r.thin.length);
}
console.log('-'.repeat(50));
console.log('TỔNG 8 module: ' + total + ' trang | có nội dung: ' + okTotal + ' | trang mỏng: ' + res.reduce((a, r) => a + r.thin.length, 0));
console.log('\nChi tiết trang mỏng (tối đa 30):');
res.forEach(r => { if (r.thin.length) { console.log('-- ' + r.name); r.thin.slice(0, 10).forEach(f => console.log('     ' + f)); } });
