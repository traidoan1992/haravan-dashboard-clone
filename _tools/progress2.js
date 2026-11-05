// Phân biệt trang ĐÃ chụp lại trong phiên này vs còn là bản cũ
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const since = new Date(Date.now() - 100 * 60 * 1000);
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const groups = {};
for (const f of files) {
  const st = fs.statSync(path.join(ROOT, f));
  const parts = f.replace(/\.html$/, '').split('_');
  let key = parts[0];
  if (key === 'index') key = 'dashboard';
  if (key === 'sale') key = 'sale_channels';
  if (key === 'draft') key = 'draft_orders';
  if (key === 'marketings') key = 'marketings';
  groups[key] = groups[key] || { total: 0, fresh: 0 };
  groups[key].total++;
  if (st.mtime > since) groups[key].fresh++;
}
console.log('mô-đun'.padEnd(18) + 'tổng'.padStart(6) + 'chụp lại'.padStart(10) + '   trạng thái');
Object.entries(groups).sort((a, b) => b[1].total - a[1].total).forEach(([k, v]) => {
  const pct = Math.round(v.fresh / v.total * 100);
  const state = v.fresh === v.total ? '✔ xong' : v.fresh === 0 ? '… chưa động tới' : '◐ ' + pct + '%';
  console.log(k.padEnd(18) + String(v.total).padStart(6) + String(v.fresh).padStart(10) + '   ' + state);
});
