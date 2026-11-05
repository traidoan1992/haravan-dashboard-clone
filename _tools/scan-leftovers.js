// Quét các "dấu vết" còn sót trong bản clone tĩnh (chỉ đọc, không ghi gì).
// Dùng: node _tools/scan-leftovers.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const checks = [
  ['URL tuyệt đối tới admin thật', /https?:\/\/noritake\.myharavan\.com/gi],
  ['Link tới domain haravan khác', /https?:\/\/[a-z0-9.-]*haravan\.(com|app|vn)/gi],
  ['root-relative ("/...")', /(?:href|src|action)="\/(?!\/)[^"]*"/gi],
  ['protocol-relative ("//host")', /(?:href|src|action|content)="\/\/[^"]+"/gi],
  ['chrome-extension://', /chrome-extension:\/\//gi],
  ['<form', /<form\b/gi],
  ['<iframe', /<iframe\b/gi],
  ['onclick=/onchange=/onsubmit=', /\son(?:click|change|submit|input)="/gi],
  ['href="" hoặc "#"', /href="(?:|#)"/g],
  ['srcset=', /\ssrcset="/gi],
  ['<script src (JS của site)', /<script\b[^>]*\bsrc="/gi],
  ['<link ... stylesheet', /<link\b[^>]*stylesheet/gi]
];

const rows = [];
const perFile = new Map();
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hits = {};
  let dirty = false;
  for (const [label, re] of checks) {
    const n = (html.match(re) || []).length;
    hits[label] = n;
    if (n) dirty = true;
  }
  if (dirty) perFile.set(f, hits);
  rows.push({ f, html });
}

console.log('Tổng file HTML: ' + files.length + '\n');
console.log('Mẫu'.padEnd(34) + 'Số dòng'.padStart(9) + '  File'.padStart(7));
console.log('-'.repeat(54));
for (const [label, re] of checks) {
  let total = 0, nf = 0;
  for (const { html } of rows) { const n = (html.match(re) || []).length; total += n; if (n) nf++; }
  console.log(label.padEnd(34) + String(total).padStart(9) + String(nf).padStart(7));
}

// Trang nhỏ bất thường (nghi chỉ có shell, chưa render)
const small = rows.filter(r => r.html.length < 60000).map(r => r.f + ' (' + r.html.length + ')');
console.log('\nTrang < 60 KB (nghi chưa render đủ): ' + small.length);
small.slice(0, 15).forEach(s => console.log('   ' + s));

// Trang còn link tuyệt đối tới admin thật
const absPages = rows.filter(r => /https?:\/\/noritake\.myharavan\.com/i.test(r.html));
console.log('\nTrang còn URL tuyệt đối tới admin thật: ' + absPages.length);
absPages.slice(0, 10).forEach(r => {
  const m = r.html.match(/https?:\/\/noritake\.myharavan\.com[^"'\s<>]*/i);
  console.log('   ' + r.f + ' → ' + (m ? m[0].slice(0, 90) : ''));
});

// Trang còn iframe
const iframes = rows.filter(r => /<iframe\b/i.test(r.html)).map(r => r.f);
console.log('\nTrang có iframe: ' + iframes.length);
iframes.slice(0, 30).forEach(f => console.log('   ' + f));

// 5 file "bẩn" nhất
console.log('\nFile còn nhiều vấn đề nhất:');
[...perFile.entries()]
  .map(([f, h]) => [f, Object.values(h).reduce((a, b) => a + b, 0)])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([f, n]) => console.log('   ' + String(n).padStart(6) + '  ' + f));
