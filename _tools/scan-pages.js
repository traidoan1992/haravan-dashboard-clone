// Kiểm tra chất lượng nội dung từng trang clone (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const bad404 = [], shell = [], iframeOnly = [], noTitle = [], short = [];
const scriptSrc = {};
const styles = {};
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  if (!title.trim()) noTitle.push(f);
  if (/404|không tìm thấy|not found/i.test(title)) bad404.push(f + '  [' + title + ']');
  if (/^Omni\s*~\s*Haravan\s*$/.test(title.trim())) shell.push(f);
  if (html.length < 60000) short.push([f, html.length, title]);
  // trang chỉ là iframe?
  const ifr = (html.match(/<iframe\b/gi) || []).length;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (ifr > 0 && text.length < 3000) iframeOnly.push(f + '  text=' + text.length + '  iframe=' + ifr);
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
    const u = m[1];
    const key = /^https?:/.test(u) ? 'EXT' : 'LOCAL';
    scriptSrc[key] = (scriptSrc[key] || 0) + 1;
    if (key === 'EXT' && !scriptSrc.extSample) scriptSrc.extSample = f + ' :: ' + u.slice(0, 110);
  }
}

console.log('Tổng: ' + files.length);
console.log('Không có <title>: ' + noTitle.length);
console.log('Title 404: ' + bad404.length); bad404.slice(0, 8).forEach(x => console.log('   ' + x));
console.log('Title shell "Omni ~ Haravan": ' + shell.length); shell.slice(0, 8).forEach(x => console.log('   ' + x));
console.log('\n<script src>: ' + JSON.stringify(scriptSrc));
console.log('\nTrang chỉ là iframe (text < 3000 ký tự): ' + iframeOnly.length);
iframeOnly.slice(0, 20).forEach(x => console.log('   ' + x));
console.log('\nTrang < 60 KB: ' + short.length);
short.slice(0, 40).forEach(([f, n, t]) => console.log('   ' + String(n).padStart(7) + '  ' + f + '  [' + t.slice(0, 45) + ']'));
