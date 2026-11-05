// ĐỢT 1 — Cắt rò rỉ sang production.
//   - href="https://noritake.myharavan.com/admin/..."  -> file local nếu có, ngược lại href="#" data-uncloned
//   - document.seller_domain="https://noritake.myharavan.com/admin" -> ""
// Dùng: node _tools/neutralize-abs.js            (dry-run, chỉ đếm)
//       node _tools/neutralize-abs.js --apply    (ghi file, có backup)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const BACKUP = path.join(__dirname, '_backup', 'dot1');
const APPLY = process.argv.includes('--apply');
const HOST = 'noritake.myharavan.com';
const SPECIAL = { '/admin': 'index.html', '/admin/': 'index.html', '/admin/dashboard/generals': 'index.html' };

const fileFor = p => {
  if (SPECIAL[p]) return SPECIAL[p];
  const q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!q) return 'index.html';
  return q.replace(/\//g, '_') + '.html';
};
const exists = f => fs.existsSync(path.join(ROOT, f));

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const stat = { relinked: 0, neutral: 0, seller: 0, changedFiles: 0 };
const samples = { neutral: [] };

for (const f of files) {
  const p = path.join(ROOT, f);
  const html = fs.readFileSync(p, 'utf8');
  let out = html;
  let nRel = 0, nNeu = 0, nSel = 0;

  // 1) href tới admin thật
  out = out.replace(/(\shref=")(https?:\/\/noritake\.myharavan\.com)(\/[^"]*)?"/g, (all, pre, host, rest) => {
    const raw = rest || '';
    const hadQuery = raw.includes('?');
    const rawPath = raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    // /admin/assets/... : nếu có file local thì trỏ vào, không thì để Đợt 2 xử lý ảnh
    if (/^\/admin\/assets\//.test(rawPath)) {
      const rel = rawPath.replace(/^\/admin\//, '');
      if (exists(rel)) { nRel++; return pre + rel + '"'; }
      return all;
    }
    if (!hadQuery) {
      const target = fileFor(rawPath);
      if (target && exists(target)) { nRel++; return pre + target + '"'; }
    }
    nNeu++;
    if (samples.neutral.length < 6) samples.neutral.push(f + '  ' + rawPath + (hadQuery ? '?…' : ''));
    return pre + 'not-cloned.html#' + encodeURI(rawPath) + '" data-uncloned="1"';
  });

  // 2) href dạng không có path (/admin, /)
  out = out.replace(/(\shref=")(https?:\/\/noritake\.myharavan\.com)"?/g, (all, pre) => {
    nRel++; return pre + 'index.html"';
  });

  // 3) seller_domain trong JS inline
  out = out.replace(/(seller_domain\s*=\s*")(https?:\/\/noritake\.myharavan\.com\/admin)(")/g, (all, a, b, c) => {
    nSel++; return a + '' + c;
  });

  if (out !== html) {
    stat.changedFiles++;
    if (APPLY) {
      if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });
      const b = path.join(BACKUP, f);
      if (!fs.existsSync(b)) fs.copyFileSync(p, b);
      fs.writeFileSync(p, out, 'utf8');
    }
  }
  stat.relinked += nRel; stat.neutral += nNeu; stat.seller += nSel;
}

console.log((APPLY ? 'ĐÃ GHI' : 'DRY-RUN') + '  |  file đổi: ' + stat.changedFiles + ' / ' + files.length);
console.log('  href -> file local      : ' + stat.relinked);
console.log('  href -> "#" (chưa clone): ' + stat.neutral);
console.log('  seller_domain -> ""     : ' + stat.seller);
if (samples.neutral.length) {
  console.log('  ví dụ bị neutralize:');
  samples.neutral.forEach(s => console.log('    ' + s));
}
if (!APPLY) console.log('\nChạy lại với --apply để ghi file (backup ở _tools/_backup/dot1/).');
