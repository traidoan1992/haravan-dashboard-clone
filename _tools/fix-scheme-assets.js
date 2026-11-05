// Vá lỗi scheme do thay thế URL protocol-relative: "https:assets/cdn/..." -> "assets/cdn/..."
// Đồng thời báo cáo tham chiếu ngoài còn lại trong file CSS.
// Dùng: node _tools/fix-scheme-assets.js [--apply]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let fixedFiles = 0, fixedRefs = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  const html = fs.readFileSync(p, 'utf8');
  const m = html.match(/https?:assets\//g) || [];
  if (!m.length) continue;
  fixedRefs += m.length; fixedFiles++;
  if (APPLY) fs.writeFileSync(p, html.replace(/https?:assets\//g, 'assets/'), 'utf8');
}
console.log((APPLY ? 'ĐÃ SỬA' : 'DRY-RUN') + ' | "https:assets/" : ' + fixedRefs + ' chỗ / ' + fixedFiles + ' file');

// CSS
const cssDir = path.join(ROOT, 'assets');
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
let cssExt = 0, cssRemote = [];
for (const f of cssFiles) {
  const t = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const urls = t.match(/url\(\s*['"]?(?:https?:)?\/\/[^)'"]+/gi) || [];
  if (urls.length) { cssExt += urls.length; cssRemote.push(f + ' → ' + urls.length + ' vd ' + urls[0].slice(0, 80)); }
}
console.log('CSS còn url() ra ngoài: ' + cssExt);
cssRemote.slice(0, 10).forEach(x => console.log('   ' + x));

// Ảnh: đếm tham chiếu còn trỏ CDN trong CSS/HTML
const htmlCdn = files.reduce((a, f) => a + (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\/\/[a-z.]*hstatic\.net/gi) || []).length, 0);
console.log('HTML còn "//*.hstatic.net": ' + htmlCdn);
