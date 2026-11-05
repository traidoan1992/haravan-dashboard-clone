// Tìm các URL thuộc 8 module CÓ TRÊN SITE nhưng CHƯA có file clone
// (dựa vào link tuyệt đối còn sót trong HTML local — bỏ qua phân trang)
// node _tools/missing-urls.js [--json]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const HOST = 'noritake.myharavan.com';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const PREFIXES = ['/admin/dashboard', '/admin/orders', '/admin/draft_orders', '/admin/products',
  '/admin/customers', '/admin/inventory', '/admin/accounting', '/admin/discounts', '/admin/reports'];

const SPECIAL = { '/admin': 'index.html', '/admin/': 'index.html', '/admin/dashboard/generals': 'index.html' };
function fileFor(p) {
  if (SPECIAL[p]) return SPECIAL[p];
  const q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!q) return 'index.html';
  return q.replace(/\//g, '_') + '.html';
}
const inScope = p => PREFIXES.some(x => p === x || p.startsWith(x + '/'));

const missing = new Map(); // path -> {count, referers:Set}
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/(?:href|src|action)="(?:https?:\/\/noritake\.myharavan\.com)?(\/admin\/[^"?#]*)/g)) {
    const p = m[1].replace(/\/+$/, '') || '/admin';
    if (!inScope(p)) continue;
    if (/\/assets\//.test(p)) continue;
    if (fileExists(p)) continue;
    if (!missing.has(p)) missing.set(p, new Set());
    missing.get(p).add(f);
  }
}
function fileExists(p) {
  const f = fileFor(p);
  return f && fs.existsSync(path.join(ROOT, f));
}

const list = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
if (process.argv.includes('--json')) {
  fs.writeFileSync(path.join(__dirname, 'missing-urls.json'), JSON.stringify(list.map(([p, s]) => ({ url: p, refs: [...s].slice(0, 3) })), null, 1));
}
console.log('Trang CÓ trên site nhưng CHƯA clone:', list.length);
const byModule = {};
list.forEach(([p]) => { const k = p.split('/')[2]; byModule[k] = (byModule[k] || 0) + 1; });
Object.entries(byModule).forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  /' + k));
console.log('\nVí dụ (30):');
list.slice(0, 30).forEach(([p, s]) => console.log('   ' + p + '   ← ' + [...s][0]));
