// Ước lượng dung lượng cần tải nếu muốn offline toàn bộ ảnh CDN (chỉ HEAD).
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const uniq = new Set();
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/\/\/(?:cdn|product|file)\.hstatic\.net\/[^"'\s)]+/gi)) uniq.add('https:' + m[0]);
}
const all = [...uniq];
const step = Math.max(1, Math.floor(all.length / 15));
const sample = all.filter((_, i) => i % step === 0).slice(0, 15);
console.log('unique ảnh CDN: ' + all.length + ' | mẫu HEAD: ' + sample.length);

const head = url => new Promise(res => {
  const r = https.request(url, { method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0' } }, resp => {
    let n = Number(resp.headers['content-length'] || 0); resp.resume();
    res({ url, status: resp.statusCode, bytes: n });
  });
  r.on('error', () => res({ url, status: 0, bytes: 0 }));
  r.end();
});

(async () => {
  let sum = 0, n = 0;
  for (const u of sample) {
    const h = await head(u);
    if (h.status === 200 && h.bytes) { sum += h.bytes; n++; }
    console.log('  ' + String(h.status).padStart(3) + '  ' + String(h.bytes).padStart(9) + '  ' + u.slice(8, 90));
  }
  if (n) {
    const avg = sum / n;
    console.log('\nTB: ' + Math.round(avg / 1024) + ' KB/ảnh → ước tính tổng: ' + (avg * all.length / 1048576).toFixed(1) + ' MB (' + all.length + ' ảnh)');
  }
})();
