// Kiểm tra từng mục sidebar của 1 trang: mở được không, có nội dung không
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');

const src = process.argv[2] || 'index.html';
const t = fs.readFileSync(path.join(ROOT, src), 'utf8');

// lấy link sidebar (thẻ <a> trong khối menu trái) — bỏ link ngoài
const targets = [];
const seen = new Set();
for (const m of t.matchAll(/<a\b[^>]*href="([a-z0-9_\-]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)) {
  const href = m[1];
  const text = m[2].replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!text || seen.has(href)) continue;
  seen.add(href);
  targets.push([href, text]);
}

const get = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.setEncoding('utf8'); r.on('data', c => (b += c)); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', rej);
});

(async () => {
  console.log(`Sidebar của ${src}: ${targets.length} mục\n`);
  for (const [href, text] of targets) {
    let r;
    try { r = await get('http://127.0.0.1:3100/' + href); } catch (e) { console.log(`LỖI      ${href}  ${e.message}`); continue; }
    const title = ((r.body.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim().replace(/^Noritake Vietnam ~ |~ Haravan$/g, '');
    const txt = r.body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().length;
    const iframe = /<iframe[^>]*src="https:\/\/(customers|reports)\.haravan\.app/i.test(r.body);
    const bad = r.status !== 200 || txt < 1200 || /Lỗi 404/.test(title);
    console.log(`${bad ? '✗' : '✓'} ${String(r.status)} ${String(txt).padStart(5)}ch  ${href.padEnd(42)} ${title}${iframe ? '  [iframe]' : ''}`);
  }
})();
