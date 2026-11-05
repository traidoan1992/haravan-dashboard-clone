// Chụp lại các trang còn thiếu từ hệ thống thật — CHỈ GET, không bao giờ ghi.
// Chuẩn bị: lưu chuỗi header "Cookie" của phiên admin vào _mirror/cookies.txt (1 dòng).
// Dùng:
//   node _tools/capture.js --probe          # chỉ xem status/title, không ghi file
//   node _tools/capture.js --fetch          # ghi HTML vào haravan_dashboard_html/
//   node _tools/capture.js --probe --url=/admin/draft_orders
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const COOKIE_FILE = [path.join(__dirname, '..', '_mirror', 'cookie.txt'), path.join(__dirname, '..', '_mirror', 'cookies.txt')]
  .find(p => fs.existsSync(p)) || '';
const HOST = 'noritake.myharavan.com';
const PROBE_ONLY = !process.argv.includes('--fetch');
const argOf = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];

// URL -> tên file clone
const TARGETS = [
  ['/admin/draft_orders', 'draft_orders.html'],
  ['/admin/inventory/inventory_receives', 'inventory_inventory_receives.html'],
  ['/admin/inventory/purchase_returns', 'inventory_purchase_returns.html']
];

if (!COOKIE_FILE) {
  console.error('Thiếu _mirror/cookie.txt (hoặc cookies.txt)');
  console.error('Hãy mở admin (đã đăng nhập) → DevTools → Network → copy header "Cookie" → lưu 1 dòng vào file đó.');
  process.exit(1);
}
const COOKIE = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
if (!/session|_haravan|sid/i.test(COOKIE)) console.warn('(!) cookies.txt không thấy cookie phiên — kiểm tra lại.');

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('quá nhiều redirect'));
    const req = https.request({
      method: 'GET',
      hostname: HOST,
      path: url,
      headers: {
        cookie: COOKIE,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'vi,en;q=0.9',
        referer: 'https://' + HOST + '/admin'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? new URL(res.headers.location).pathname + new URL(res.headers.location).search : res.headers.location;
        return get(loc, depth + 1).then(resolve, reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, finalPath: url, body }));
    });
    req.on('error', reject);
    req.end(); // GET, không gửi body -> không thể là lệnh ghi
  });
}

const titleOf = h => ((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
const isLogin = h => /users\/sign_in|account\/login|name="password"/i.test(h);
const is404 = t => /Lỗi 404/.test(t);

(async () => {
  // nếu có --url thì chỉ chụp URL đó
  const only = argOf('url');
  const list = only ? [[only, only.replace(/^\/admin\/?/, '').replace(/\//g, '_') + '.html']] : TARGETS;
  let okCount = 0, skipped = 0;

  for (const [url, file] of list) {
    let r;
    try { r = await get(url); } catch (e) { console.log(`LỖI  ${url}  ${e.message}`); continue; }
    const title = titleOf(r.body);
    const login = isLogin(r.body);
    const nf = is404(title) || is404(r.body.slice(0, 4000));
    const good = r.status === 200 && !login && !nf && r.body.length > 20000;
    console.log(`${good ? 'OK  ' : 'HỎNG'} ${url}  status=${r.status}  bytes=${r.body.length}  title=${title}${login ? '  <-- trang đăng nhập (cookie hết hạn)' : ''}${nf ? '  <-- vẫn là Lỗi 404' : ''}`);

    if (!good) { skipped++; continue; }
    okCount++;
    if (!PROBE_ONLY) {
      const out = path.join(ROOT, file);
      if (fs.existsSync(out)) fs.copyFileSync(out, path.join(__dirname, '_backup', file + '.old'));
      fs.writeFileSync(out, r.body, 'utf8');
      console.log('     đã ghi → ' + file);
    }
    // nếu là trang danh sách đơn nháp: chụp luôn các trang chi tiết đã có sẵn tên file
    if (url === '/admin/draft_orders' && !only) {
      const ids = [...new Set([...r.body.matchAll(/\/admin\/draft_orders\/([0-9a-f]{20,})/g)].map(m => m[1]))];
      const existing = fs.readdirSync(ROOT).filter(f => /^draft_orders_[0-9a-f]{20,}\.html$/.test(f)).map(f => f.slice(13, -5));
      const need = existing.filter(id => ids.includes(id));
      console.log(`     danh sách có ${ids.length} đơn nháp; file clone cần chụp lại: ${need.length}`);
      for (const id of need) {
        try {
          const d = await get('/admin/draft_orders/' + id);
          const dt = titleOf(d.body);
          const dgood = d.status === 200 && !is404(dt) && d.body.length > 20000;
          console.log(`      ${dgood ? 'OK  ' : 'HỎNG'} draft_orders/${id}  bytes=${d.body.length}  title=${dt}`);
          if (dgood && !PROBE_ONLY) fs.writeFileSync(path.join(ROOT, 'draft_orders_' + id + '.html'), d.body, 'utf8');
        } catch (e) { console.log('      LỖI ' + id + ' ' + e.message); }
      }
    }
  }
  console.log(`\nTổng: OK=${okCount}  bỏ qua=${skipped}  chế độ=${PROBE_ONLY ? 'CHỈ XEM (--probe)' : 'GHI FILE (--fetch)'}`);
})();
