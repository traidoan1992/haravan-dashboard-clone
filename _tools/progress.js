// Tiến độ clone: bao nhiêu trang đã có nội dung thật, bao nhiêu là trang bọc iframe
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let real = 0, wrap = 0, shell = 0, notFound = 0;
const newSince = new Date(Date.now() - 100 * 60 * 1000);
let touched = 0;
const perModule = {};
const bump = (k, t) => { perModule[k] = perModule[k] || { n: 0, real: 0 }; perModule[k].n++; if (t === 'real') perModule[k].real++; };

for (const f of files) {
  const full = path.join(ROOT, f);
  const st = fs.statSync(full);
  if (st.mtime > newSince) touched++;
  const t = fs.readFileSync(full, 'utf8');
  const title = ((t.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const text = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const isWrap = /<iframe[^>]*src="https:\/\/(customers|reports|apps)\.haravan\.app/i.test(t);
  let kind;
  if (/Lỗi 404/.test(title)) { notFound++; kind = '404'; }
  else if (isWrap) { wrap++; kind = 'wrap'; }
  else if (text.length >= 1200) { real++; kind = 'real'; }
  else { shell++; kind = 'shell'; }
  const key = f.split('_')[0].replace(/\.html$/, '');
  bump(key, kind);
}

console.log(`Tổng file: ${files.length}   (ghi trong ~100 phút qua: ${touched})`);
console.log(`Có nội dung thật: ${real}   |  Trang bọc iframe (app ngoài): ${wrap}   |  Ít nội dung: ${shell}   |  Trang 404: ${notFound}`);
console.log('\nTheo mô-đun (tổng / có nội dung thật):');
Object.entries(perModule).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log('  ' + k.padEnd(26) + String(v.n).padStart(4) + ' / ' + v.real));
