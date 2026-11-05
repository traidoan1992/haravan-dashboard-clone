// Phân loại URL tuyệt đối tới admin thật + iframe + onclick trong bản clone (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const cat = {};
const add = k => (cat[k] = (cat[k] || 0) + 1);
const samples = {};

for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // mọi lần xuất hiện, kèm ngữ cảnh 40 ký tự trước
  const re = /https?:\/\/noritake\.myharavan\.com[^"'\s<>)\\]*/gi;
  let m;
  while ((m = re.exec(html))) {
    const before = html.slice(Math.max(0, m.index - 60), m.index);
    let k;
    if (/href="$/.test(before)) k = 'a.href';
    else if (/src="$/.test(before)) k = 'src';
    else if (/action="$/.test(before)) k = 'form.action';
    else if (/\{?["'](?:url|href|link|permalink)["']:\s*["']$/.test(before)) k = 'JS: state/url';
    else if (/<script[^>]*>[^<]*$/.test(before)) k = 'JS: script string';
    else if (/^\s*$|["'(]$/.test(before.slice(-1))) k = 'other';
    else k = 'other';
    add(k);
    if (!samples[k]) samples[k] = f + '  …' + before.slice(-45) + m[0].slice(0, 80);
  }
}
console.log('=== Phân loại URL tuyệt đối tới admin thật ===');
Object.entries(cat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(String(v).padStart(7) + '  ' + k + '\n         vd: ' + samples[k]);
});

// iframe: host
const iframeHosts = {};
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const src = (m[0].match(/src="([^"]*)"/i) || [])[1] || '(không src)';
    const host = src.replace(/^https?:\/\//, '').split('/')[0] || '(rỗng)';
    iframeHosts[host] = (iframeHosts[host] || 0) + 1;
  }
}
console.log('\n=== Host của <iframe> ===');
Object.entries(iframeHosts).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([h, n]) => console.log(String(n).padStart(7) + '  ' + h));

// onclick: mẫu
const onclickSamples = new Set();
let onclickTotal = 0;
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/\son(?:click|change|submit|input)="([^"]*)"/gi)) {
    onclickTotal++;
    if (onclickSamples.size < 12) onclickSamples.add(f + ' :: ' + m[0].slice(0, 100));
  }
}
console.log('\n=== onclick/onchange/onsubmit: ' + onclickTotal + ' ===');
[...onclickSamples].forEach(s => console.log('   ' + s));
