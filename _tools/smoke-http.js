// Smoke HTTP: mọi trang clone phải trả 200, có nội dung, không có lỗi render
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const get = url => new Promise((res, rej) => {
  http.get(url, r => {
    let b = '';
    r.setEncoding('utf8');
    r.on('data', c => (b += c));
    r.on('end', () => res({ status: r.statusCode, bytes: Buffer.byteLength(b), body: b }));
  }).on('error', rej);
});

(async () => {
  let ok = 0; const bad = [];
  for (const f of files) {
    const { status, bytes, body } = await get('http://127.0.0.1:3100/' + encodeURIComponent(f));
    const hasFatal = /Fatal error|Uncaught (Error|TypeError)/i.test(body);
    if (status === 200 && bytes > 5000 && !hasFatal) ok++;
    else bad.push(`${f} status=${status} bytes=${bytes}${hasFatal ? ' (lỗi render)' : ''}`);
  }
  console.log(`200 OK + nội dung: ${ok}/${files.length}`);
  if (bad.length) { console.log('Cần xem lại:'); bad.forEach(b => console.log('   ' + b)); }
})();
