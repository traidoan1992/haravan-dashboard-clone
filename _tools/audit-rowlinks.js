// Kiểm toán: các anchor trỏ tới file clone nhưng chữ hiển thị KHÔNG phải bản ghi của file đó.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const textOf = s => decode(s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const titleOf = html => (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].trim();

const keyOfFile = new Map(); // file -> Set(keys)
const keyToFile = new Map();
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const t = titleOf(html);
  const set = new Set();
  let m;
  if ((m = /Chi tiết đơn hàng ~ ([^~]+)~/.exec(t))) set.add(m[1].trim());
  else if (/^customers_\d+\.html$/.test(f) && (m = /^Noritake Vietnam ~ ([^~]+)~/.exec(t))) set.add(m[1].trim());
  else if ((m = /Chi tiết sản phẩm ~ ([^~]+)~/.exec(t))) { set.add(m[1].trim()); const s = (m[1].match(/([0-9]{4}[A-Za-z]-[0-9]{5})$/) || [])[1]; if (s) set.add(s); }
  else if ((m = /Chi tiết nhóm sản phẩm ~ ([^~]+)~/.exec(t))) set.add(m[1].trim());
  else if (/^shipments_(\d+)\.html$/.test(f)) set.add(f.match(/^shipments_(\d+)\.html$/)[1]);
  if (!set.size) continue;
  keyOfFile.set(f, set);
  for (const k of set) if (!keyToFile.has(k)) keyToFile.set(k, f);
}

const wrong = new Map(); // file -> count
const suspects = new Map();
const ANCHOR = /<a\b[^>]*?href="((?:orders|products|shipments|customers|products_collections|discounts)_[0-9a-f]+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m;
  while ((m = ANCHOR.exec(html))) {
    const href = m[1];
    const txt = textOf(m[2]);
    const keys = keyOfFile.get(href);
    if (!keys) { suspects.set(f + ' → ' + href, (suspects.get(f + ' → ' + href) || 0) + 1); continue; }
    if (keys.has(txt)) continue;
    if (keyToFile.get(txt) && keyToFile.get(txt) !== href) {
      wrong.set(f, (wrong.get(f) || 0) + 1);            // chữ là bản ghi của file KHÁC → chắc chắn sai
    } else {
      suspects.set(f + ' → ' + href, (suspects.get(f + ' → ' + href) || 0) + 1); // có thể sai
    }
  }
}
console.log('Sai chắc chắn (chữ thuộc bản ghi khác):');
[...wrong.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log('   ' + String(c).padStart(3) + '  ' + f));
console.log('\nChưa đối chiếu được (chữ không thuộc bản ghi nào đã clone):');
[...suspects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, c]) => console.log('   ' + String(c).padStart(3) + '  ' + k));
