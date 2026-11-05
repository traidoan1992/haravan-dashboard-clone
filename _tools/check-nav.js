// Kiểm tra link sidebar/điều hướng ở 1 trang: đích có tồn tại không
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2] || 'index.html';
const t = fs.readFileSync(path.join(ROOT, f), 'utf8');

const seen = new Set();
const rows = [];
for (const m of t.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
  const attrs = m[1];
  const hm = /href="([^"]*)"/.exec(attrs);
  const href = hm ? hm[1] : '(không có href)';
  const text = m[2].replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
  const key = href + '|' + text;
  if (seen.has(key)) continue;
  seen.add(key);
  let state;
  if (/^https?:/.test(href)) state = 'RA NGOÀI';
  else if (href.startsWith('#')) state = 'dead #';
  else if (/^[a-z0-9_\-.]+\.html$/i.test(href)) state = fs.existsSync(path.join(ROOT, href)) ? 'OK' : 'THIẾU FILE';
  else if (href.startsWith('/')) state = 'ĐƯỜNG DẪN GỐC';
  else state = '?';
  rows.push({ text, href: href.slice(0, 60), state });
}
const bad = rows.filter(r => r.state !== 'OK');
console.log(`${f}: ${rows.length} link | không OK: ${bad.length}`);
bad.slice(0, 40).forEach(r => console.log(`  [${r.state}] "${r.text}"  -> ${r.href}`));
