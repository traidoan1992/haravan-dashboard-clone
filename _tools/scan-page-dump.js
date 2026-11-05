// Xem nhanh cấu trúc 1 file clone: node _tools/scan-page-dump.js <file.html>
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2];
const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('file        : ' + f);
console.log('bytes       : ' + html.length);
console.log('title       : ' + ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''));
console.log('root div    : ' + (/<div[^>]+id="root"[^>]*>([\s\S]{0,80})/i.exec(html) ? 'có' : 'không'));
console.log('script src  : ' + (html.match(/<script\b[^>]*\bsrc="[^"]+"/gi) || []).length);
console.log('iframe      : ' + (html.match(/<iframe\b[^>]*>/gi) || []).map(s => (s.match(/src="([^"]*)"/i) || [])[1] || '(no src)').join(' | '));
console.log('text length : ' + text.length);
console.log('text        : ' + text.slice(0, 500));
const cls = [...html.matchAll(/class="([^"]{3,60})"/g)].map(m => m[1]).slice(0, 25);
console.log('class đầu   : ' + cls.join(' · '));
