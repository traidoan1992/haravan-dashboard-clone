// Kiểm toán riêng BƯỚC 3: thư mục haravan_dashboard_html/ có tự chạy được bằng static server không?
// node _tools/audit-static.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const stats = { external: 0, localOk: 0, localMissing: 0, rootRel: 0, parentRel: 0, protoRel: 0, empty: 0 };
const missing = new Map();   // target -> số lần
const rootRel = new Map();
const parentRel = new Map();

const isExternal = s => /^(https?:|mailto:|tel:|javascript:|data:|blob:|#)/i.test(s);

for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/(?:href|src|action)="([^"]*)"/g)) {
    const raw = m[1];
    if (!raw) { stats.empty++; continue; }
    if (isExternal(raw)) { stats.external++; continue; }
    if (raw.startsWith('//')) { stats.protoRel++; continue; }
    if (raw.startsWith('/')) { stats.rootRel++; rootRel.set(raw.split('?')[0], (rootRel.get(raw.split('?')[0]) || 0) + 1); continue; }
    if (raw.startsWith('../')) { stats.parentRel++; parentRel.set(raw, (parentRel.get(raw) || 0) + 1); continue; }
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) { stats.empty++; continue; }
    const abs = path.join(ROOT, clean);
    if (fs.existsSync(abs)) stats.localOk++;
    else { stats.localMissing++; missing.set(clean, (missing.get(clean) || 0) + 1); }
  }
}

console.log('Thư mục:', ROOT);
console.log('Số trang HTML:', files.length, '| có index.html:', fs.existsSync(path.join(ROOT, 'index.html')));
console.log('\nPhân loại tham chiếu:');
console.log('  nội bộ, file tồn tại      :', stats.localOk);
console.log('  nội bộ, FILE THIẾU        :', stats.localMissing);
console.log('  tuyệt đối "/..." (sai)    :', stats.rootRel);
console.log('  "../" (sai)               :', stats.parentRel);
console.log('  "//" protocol-relative    :', stats.protoRel);
console.log('  rỗng / "#"               :', stats.empty);
console.log('  ra ngoài (http,mailto…)   :', stats.external);

if (missing.size) { console.log('\nFile thiếu (top 20):'); [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  ' + k)); }
if (rootRel.size) { console.log('\nĐường dẫn gốc (top 10):'); [...rootRel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  ' + k)); }
if (parentRel.size) { console.log('\nĐường dẫn "../" (top 10):'); [...parentRel.entries()].slice(0, 10).forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  ' + k)); }
