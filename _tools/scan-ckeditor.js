// Đếm tài nguyên CKEditor + script bên thứ ba (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const ck = new Set(), ext = new Set(), extPages = new Set();
let extHits = 0;
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/https?:\/\/noritake\.myharavan\.com\/admin\/ckeditor[^"'\s)]*/gi)) ck.add(m[0]);
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi)) {
    ext.add(m[1]); extHits++; extPages.add(f);
  }
}
console.log('CKEditor unique: ' + ck.size);
[...ck].slice(0, 20).forEach(u => console.log('   ' + u.slice(38)));
console.log('\n<script src> ngoài: ' + extHits + ' lượt | ' + ext.size + ' URL unique | ' + extPages.size + ' trang');
[...ext].slice(0, 10).forEach(u => console.log('   ' + u.slice(0, 90)));
