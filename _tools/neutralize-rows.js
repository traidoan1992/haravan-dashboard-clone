// Bỏ href ở các link dòng bị "trỏ đồng loạt" (di chứng rewrite cũ): giữ nguyên thẻ <a> + class,
// chỉ bỏ thuộc tính href để bấm vào không mở nhầm trang chi tiết.
// Chạy: node _tools/neutralize-rows.js [--apply]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const DETAIL = /^(orders_\d+|products_\d+|shipments_\d+|customers_\d+|discounts_\d+|products_collections_\d+)\.html$/;
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const textOf = s => decode(s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const titleOf = html => (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].trim();

// khoá nhận diện của từng file chi tiết
const keysOf = new Map();
for (const f of files) {
  const t = titleOf(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  let m;
  if ((m = /Chi tiết đơn hàng ~ ([^~]+)~/.exec(t))) keysOf.set(f, new Set([m[1].trim()]));
  else if (/^customers_\d+\.html$/.test(f) && (m = /^Noritake Vietnam ~ ([^~]+)~/.exec(t))) keysOf.set(f, new Set([m[1].trim()]));
  else if ((m = /Chi tiết sản phẩm ~ ([^~]+)~/.exec(t))) {
    const s = new Set([m[1].trim()]);
    const sku = (m[1].match(/([0-9]{4}[A-Za-z]-[0-9]{5})$/) || [])[1];
    if (sku) s.add(sku);
    keysOf.set(f, s);
  } else if ((m = /Chi tiết nhóm sản phẩm ~ ([^~]+)~/.exec(t))) keysOf.set(f, new Set([m[1].trim()]));
  else if ((m = /^shipments_(\d+)\.html$/.exec(f))) keysOf.set(f, new Set([m[1]]));
  else if ((m = /<p class="title-page">([^<]+)<\/p>/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')))) keysOf.set(f, new Set([decode(m[1]).trim()]));
}

const ANCHOR = /<a\b([^>]*?)\shref="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g;
const log = [];
let touched = 0;

for (const f of files) {
  const full = path.join(ROOT, f);
  const src = fs.readFileSync(full, 'utf8');
  // đếm số lần mỗi href chi tiết xuất hiện -> nhóm bị trỏ đồng loạt
  const counts = new Map();
  for (const m of src.matchAll(/href="([^"]+)"/g)) if (DETAIL.test(m[1])) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  const clobbered = new Set([...counts.entries()].filter(([, c]) => c >= 5).map(([h]) => h));
  if (!clobbered.size) continue;

  const out = src.replace(ANCHOR, (all, pre, href, post, inner) => {
    if (!clobbered.has(href)) return all;
    const keys = keysOf.get(href);
    const txt = textOf(inner);
    if (keys && keys.has(txt)) return all; // đúng bản ghi của chính trang đó -> giữ
    log.push(`${f}: bỏ href="${href}"  chữ="${txt.slice(0, 40)}"`);
    return `<a${pre}${post}>${inner}</a>`;
  });
  if (out !== src) {
    touched++;
    if (APPLY) {
      if (!fs.existsSync(path.join(__dirname, '_backup'))) fs.mkdirSync(path.join(__dirname, '_backup'), { recursive: true });
      fs.copyFileSync(full, path.join(__dirname, '_backup', f));
      fs.writeFileSync(full, out, 'utf8');
    }
  }
}

const byFile = new Map();
log.forEach(l => { const k = l.split(':')[0]; byFile.set(k, (byFile.get(k) || 0) + 1); });
console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ' — file đổi:', touched, '| link bỏ href:', log.length);
[...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(4) + '  ' + k));
