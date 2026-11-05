// Sửa link từng dòng: dùng CHÍNH chữ hiển thị (mã đơn, ID vận chuyển, SKU, tên)
// để trỏ về đúng file clone. Chạy: node _tools/fix-rows.js [--apply]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const APPLY = process.argv.includes('--apply');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileSet = new Set(files);

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = s => decode(s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const titleOf = html => (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].trim();

// ---------- danh mục bản ghi ----------
const keys = new Map(); // key -> { file, family }
function addKey(key, file, family) {
  if (!key || key.length < 3) return;
  if (!keys.has(key)) keys.set(key, { file, family });
}

for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = titleOf(html);
  let m;
  if ((m = /^orders_(\d+)\.html$/.exec(f)) && (m2 = /Chi tiết đơn hàng ~ ([^~]+)~/.exec(title))) {
    addKey(m2[1].trim(), f, 'orders');
  } else if ((m = /^customers_(\d+)\.html$/.exec(f)) && (m2 = /^Noritake Vietnam ~ ([^~]+)~/.exec(title))) {
    addKey(m2[1].trim(), f, 'customers');
  } else if ((m = /^products_(\d+)\.html$/.exec(f)) && (m2 = /Chi tiết sản phẩm ~ ([^~]+)~/.exec(title))) {
    const full = m2[1].trim();
    const sku = (full.match(/([0-9]{4}[A-Za-z]-[0-9]{5})$/) || [])[1];
    addKey(full, f, 'products');
    if (sku) addKey(sku, f, 'products');
  } else if ((m = /^products_collections_(\d+)\.html$/.exec(f)) && (m2 = /Chi tiết nhóm sản phẩm ~ ([^~]+)~/.exec(title))) {
    addKey(m2[1].trim(), f, 'products_collections');
  } else if (/^shipments_(\d+)\.html$/.test(f)) {
    addKey(/^shipments_(\d+)\.html$/.exec(f)[1], f, 'shipments');
  } else if (/^discounts_\d+\.html$/.test(f) && (m2 = /<p class="title-page">([^<]+)<\/p>/.exec(html))) {
    addKey(decode(m2[1]).trim(), f, 'discounts');
  }
}

// ---------- sửa anchor ----------
const changes = [];
const ANCHOR = /<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g;

for (const f of files) {
  const full = path.join(ROOT, f);
  const src = fs.readFileSync(full, 'utf8');
  // bỏ qua các khối <script>/<style> để không sửa chuỗi JS
  const parts = src.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/i);
  let changed = 0;
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(ANCHOR, (all, pre, href, post, inner) => {
      const key = textOf(inner);
      const hit = keys.get(key);
      if (!hit) return all;
      if (href === hit.file) return all;
      // chỉ đổi khi đích hiện tại là '#' hoặc một file clone cùng họ
      const sameFamily = new RegExp('^' + hit.family + '_').test(href.split('_')[0] + '_') || href === '#';
      if (href !== '#' && !new RegExp('^' + hit.family + '_').test(href)) return all;
      changes.push(`${f}: "${key}"  ${href} -> ${hit.file}`);
      changed++;
      return `<a${pre}href="${hit.file}"${post}>${inner}</a>`;
    });
  }).join('');
  if (changed && APPLY) {
    if (!fs.existsSync(path.join(__dirname, '_backup'))) fs.mkdirSync(path.join(__dirname, '_backup'), { recursive: true });
    fs.copyFileSync(full, path.join(__dirname, '_backup', f));
    fs.writeFileSync(full, out, 'utf8');
  }
}

console.log('Khoá nhận diện:', keys.size, '| thay đổi:', changes.length);
const byFile = new Map();
changes.forEach(c => { const k = c.split(':')[0]; byFile.set(k, (byFile.get(k) || 0) + 1); });
[...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(3) + '  ' + k));
console.log('\nChi tiết (20 dòng đầu):');
changes.slice(0, 20).forEach(c => console.log('  ' + c));
