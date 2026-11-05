// Tìm chỗ còn sót: chrome-extension, domain haravan khác, iframe không src (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const hosts = {};
const ext = [];
const iframeNoSrc = { total: 0, pages: 0 };
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/https?:\/\/([a-z0-9.-]*haravan\.(?:com|app|vn))/gi)) {
    hosts[m[1]] = (hosts[m[1]] || 0) + 1;
  }
  const ce = html.match(/.{0,120}chrome-extension:\/\/.{0,160}/);
  if (ce && ext.length < 5) ext.push(f + '  …' + ce[0].replace(/\s+/g, ' '));
  const ifr = html.match(/<iframe\b[^>]*>/gi) || [];
  const noSrc = ifr.filter(t => !/\bsrc=/i.test(t)).length;
  if (noSrc) { iframeNoSrc.total += noSrc; iframeNoSrc.pages++; }
}
console.log('=== Host haravan còn lại ===');
Object.entries(hosts).sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(String(n).padStart(7) + '  ' + h));
console.log('\n=== chrome-extension ===');
ext.forEach(x => console.log('   ' + x));
console.log('\n=== iframe KHÔNG có src: ' + iframeNoSrc.total + ' thẻ / ' + iframeNoSrc.pages + ' trang ===');
