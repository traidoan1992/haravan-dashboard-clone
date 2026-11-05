// Tổng hợp theo module: số trang, shell, iframe-only, thiếu nội dung (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const modOf = f => {
  const m = f.match(/^(index|orders|draft_orders|products|collections|customers|inventory|accounting|discounts|reports|apps|googleshop|marketings|shipments|settings|sale_channels|[a-z_]+?)(?:_|\.html)/);
  return (m ? m[1] : 'khác');
};

const stat = {};
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();
  const shell = /^Omni\s*~\s*Haravan$/i.test(title);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const thin = text.length < 3000;
  const m = modOf(f);
  stat[m] = stat[m] || { n: 0, shell: 0, thin: 0, bytes: 0 };
  stat[m].n++;
  if (shell) stat[m].shell++;
  if (thin) stat[m].thin++;
  stat[m].bytes += html.length;
}
console.log('module'.padEnd(18) + 'trang'.padStart(7) + 'shell'.padStart(7) + 'thieuNoiDung'.padStart(14) + 'MB'.padStart(9));
console.log('-'.repeat(58));
Object.entries(stat).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => {
  console.log(k.padEnd(18) + String(v.n).padStart(7) + String(v.shell).padStart(7) + String(v.thin).padStart(14) + (v.bytes / 1048576).toFixed(1).padStart(9));
});
console.log('\nTổng: ' + files.length);
