// GẮN LINK: chuyển link tuyệt đối tới noritake.myharavan.com/admin/... thành file clone cục bộ.
// Dùng: node _tools/relink.js            (chạy thử, chỉ báo cáo)
//        node _tools/relink.js --apply    (ghi file, có sao lưu vào _tools/_backup)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const HOST = 'https://noritake.myharavan.com';
const APPLY = process.argv.includes('--apply');

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const fileSet = new Set(files);

// Trang không suy ra được bằng quy tắc đổi '/' -> '_'
const SPECIAL = {
  '/admin': 'index.html',
  '/admin/': 'index.html',
  '/admin/dashboard/generals': 'index.html'
};

// URL path -> tên file clone (nếu có)
function fileForPath(p) {
  if (SPECIAL[p]) return SPECIAL[p];
  let q = p.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!q) return 'index.html';
  const cand = q.replace(/\//g, '_') + '.html';
  if (fileSet.has(cand)) return cand;
  return null;
}

const report = { pages: new Map(), assets: [], kept: new Map(), filesTouched: 0, filesSkipped: 0 };
const backupDir = path.join(__dirname, '_backup');
if (APPLY && !fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

for (const f of files) {
  const full = path.join(ROOT, f);
  const src = fs.readFileSync(full, 'utf8');
  if (!src.includes(HOST + '/admin') && !/(?:href|src|action)="\/admin[\/"]/.test(src)) { report.filesSkipped++; continue; }

  let out = src;
  let changed = 0;

  // 0) link gốc-đường-dẫn "/admin/..." (bản chụp bằng trình duyệt) -> URL đầy đủ để các bước sau xử lý
  out = out.replace(/((?:href|src|action)=")\/admin\/([^"]*)(")/g, (all, pre, rest, post) => pre + HOST + '/admin/' + rest + post);
  out = out.replace(/((?:href|src|action)=")\/admin(")/g, (all, pre, post) => pre + HOST + '/admin' + post);

  // 1a) đúng gốc "/admin" (không có dấu / cuối) -> index.html
  out = out.replace(/((?:href|src|action)=")https:\/\/noritake\.myharavan\.com\/admin(?=["\/])(")/g, (all, pre, post) => {
    if (all.includes('/admin/')) return all;
    changed++;
    return pre + 'index.html' + post;
  });

  // 1) href/src/action tuyệt đối -> tương đối
  out = out.replace(/((?:href|src|action)=")https:\/\/noritake\.myharavan\.com\/admin\/([^"]*)(")/g, (all, pre, rest, post) => {
    const [rawPath, ...qparts] = rest.split('?');
    const query = qparts.length ? '?' + qparts.join('?') : '';
    const p = '/admin/' + rawPath;
    // asset?
    if (/^assets\//.test(rawPath)) {
      if (fs.existsSync(path.join(ROOT, rawPath))) { changed++; return pre + rawPath + post; }
      report.assets.push(rawPath); return all;
    }
    if (rawPath === 'manifest.json' || rawPath === 'favicon.ico') { changed++; return pre + rawPath + post; }
    const file = fileForPath(p);
    if (file) {
      report.pages.set(file, (report.pages.get(file) || 0) + 1);
      if (query) report.kept.set(p + query, (report.kept.get(p + query) || 0) + 1);
      changed++;
      return pre + file + post;
    }
    report.kept.set(p, (report.kept.get(p) || 0) + 1);
    return all;
  });

  // 2) link tuyệt đối khác dưới /admin (không có /admin/ ngay sau host) - chỉ báo cáo
  const other = out.match(/https:\/\/noritake\.myharavan\.com\/(?!admin\/)[^"']{0,60}/g) || [];
  other.forEach(u => report.kept.set('(ngoài /admin) ' + u, (report.kept.get('(ngoài /admin) ' + u) || 0) + 1));

  if (changed) {
    report.filesTouched++;
    if (APPLY) {
      fs.copyFileSync(full, path.join(backupDir, f));
      fs.writeFileSync(full, out, 'utf8');
    }
  }
}

console.log((APPLY ? 'ĐÃ GHI' : 'CHẠY THỬ') + ' — file đổi:', report.filesTouched, '| file không có link tuyệt đối:', report.filesSkipped);
console.log('Link trang đã gắn vào file clone:', report.pages.size, 'file đích:');
[...report.pages.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log('  ' + String(c).padStart(3) + '  ' + f));
console.log('Asset local không có, giữ tuyệt đối:', new Set(report.assets).size);
console.log('\nLink giữ nguyên (không có file clone) —', report.kept.size, 'đường dẫn khác nhau:');
[...report.kept.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([p, c]) => console.log('  ' + String(c).padStart(3) + '  ' + p));
