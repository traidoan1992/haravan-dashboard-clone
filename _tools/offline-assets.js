// ĐỢT 2 — Làm bản clone chạy offline thật.
//   A. Gỡ <script src> / <link href> bên thứ ba (GTM, GA, announcekit, socials…) + noscript GTM
//   B. Gỡ CKEditor (script/link + url() nội tuyến) — CKEditor không chạy vì đã bỏ JS của site
//   C. Tải ảnh CDN //*.hstatic.net về assets/cdn/ rồi đổi sang đường dẫn tương đối
//   D. Tải asset còn lại của /admin/assets/... về assets/ext/ rồi đổi
//   E. Xoá vết chrome-extension://
// Dùng: node _tools/offline-assets.js            (dry-run)
//       node _tools/offline-assets.js --apply    (ghi file + tải ảnh, backup ở _tools/_backup/dot2/)
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const BACKUP = path.join(__dirname, '_backup', 'dot2');
const APPLY = process.argv.includes('--apply');
const CDN_DIR = 'assets/cdn';
const EXT_DIR = 'assets/ext';
const AGENT = new https.Agent({ keepAlive: true, maxSockets: 10 });

const safeName = s => (s || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
const hashOf = u => crypto.createHash('sha1').update(u).digest('hex').slice(0, 10);

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const stat = { script: 0, link: 0, noscript: 0, inline: 0, urlFn: 0, ext: 0, cdnRefs: 0, changed: 0 };

const cdnMap = new Map(); // url(//host/...) -> local relative path
const extMap = new Map(); // https://noritake.../admin/assets/... -> local relative path

// ---------- tải file ----------
function fetchTo(url, relPath) {
  const dest = path.join(ROOT, relPath);
  if (fs.existsSync(dest)) return Promise.resolve(true);
  return new Promise(resolve => {
    const req = https.get(url, { agent: AGENT, headers: { 'user-agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        res.resume(); return resolve(fetchTo(next, relPath));
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(false); }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve(true)));
      ws.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(20000, () => { req.destroy(); resolve(false); });
  });
}

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

(async () => {
  // ---------- vòng 1: thu thập URL ảnh CDN + asset ngoài ----------
  const cdnUrls = new Set(), extUrls = new Set();
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of html.matchAll(/\/\/(?:cdn|product|file)\.hstatic\.net\/[^"'\s)]+/gi)) cdnUrls.add(m[0]);
    for (const m of html.matchAll(/https?:\/\/noritake\.myharavan\.com\/admin\/assets\/[^"'\s)]+/gi)) extUrls.add(m[0]);
  }
  console.log('Ảnh CDN cần tải: ' + cdnUrls.size + ' | asset /admin/assets còn lại: ' + extUrls.size);

  for (const u of cdnUrls) {
    const clean = u.split('?')[0];
    const base = safeName(path.posix.basename(clean));
    cdnMap.set(u, CDN_DIR + '/' + hashOf(u) + '-' + base);
  }
  for (const u of extUrls) {
    const clean = u.split('?')[0];
    const rel = clean.replace(/^https?:\/\/noritake\.myharavan\.com\//, ''); // admin/assets/...
    extMap.set(u, EXT_DIR + '/' + hashOf(u) + '-' + safeName(path.posix.basename(rel)));
  }

  if (APPLY && cdnUrls.size) {
    let done = 0, fail = 0;
    await pool([...cdnMap.entries()], 10, async ([u, rel]) => {
      const ok = await fetchTo('https:' + u, rel);
      ok ? done++ : fail++;
      if ((done + fail) % 500 === 0) console.log('   … ' + (done + fail) + '/' + cdnMap.size);
    });
    console.log('   tải CDN: OK ' + done + ' | lỗi ' + fail);
    let d2 = 0, f2 = 0;
    for (const [u, rel] of extMap) { (await fetchTo(u, rel)) ? d2++ : f2++; }
    console.log('   tải asset ngoài: OK ' + d2 + ' | lỗi ' + f2);
  }

  // ---------- vòng 2: biến đổi HTML ----------
  for (const f of files) {
    const p = path.join(ROOT, f);
    const html = fs.readFileSync(p, 'utf8');
    let out = html;
    const before = out.length;

    // A1. script bên thứ ba
    out = out.replace(/<script\b[^>]*\bsrc="(?:https?:)?\/\/[^"]+"[^>]*>\s*<\/script>\s*/gi, m => { stat.script++; return ''; });
    // A2. link bên thứ ba (stylesheet/preconnect/icon/canonical…)
    out = out.replace(/<link\b[^>]*\bhref="(?:https?:)?\/\/[^"]+"[^>]*>\s*/gi, m => { stat.link++; return ''; });
    // A3. noscript chứa GTM
    out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>\s*/gi, m => (/googletagmanager|gtm|facebook/i.test(m) ? (stat.noscript++, '') : m));
    // A4. iframe GTM
    out = out.replace(/<iframe\b[^>]*src="[^"]*(?:googletagmanager|google-analytics)[^"]*"[^>]*>\s*<\/iframe>\s*/gi, () => { stat.ext++; return ''; });
    // A5. script inline của bên thứ ba / CKEditor
    out = out.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>\s*/gi, m => {
      if (/googletagmanager|gtag\s*\(|dataLayer|google-analytics|announcekit|socials\.haravan|CKEDITOR|ckeditor4/i.test(m)) { stat.inline++; return ''; }
      return m;
    });
    // B. url(…ckeditor…) trong style
    out = out.replace(/url\(\s*(['"]?)[^)'"]*ckeditor[^)'"]*\1\s*\)/gi, () => { stat.urlFn++; return 'none'; });
    // E. vết extension
    out = out.replace(/<img\b[^>]*src="chrome-extension:\/\/[^"]*"[^>]*>/gi, () => { stat.ext++; return ''; });

    // C. ảnh CDN -> local
    for (const [u, rel] of cdnMap) {
      if (!out.includes(u)) continue;
      stat.cdnRefs += out.split(u).length - 1;
      out = out.split(u).join(rel);
    }
    // D. asset /admin/assets -> local
    for (const [u, rel] of extMap) {
      if (!out.includes(u)) continue;
      out = out.split(u).join(rel);
    }

    if (out !== html) {
      stat.changed++;
      if (APPLY) {
        if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });
        const b = path.join(BACKUP, f);
        if (!fs.existsSync(b)) fs.copyFileSync(p, b);
        fs.writeFileSync(p, out, 'utf8');
      }
      if (process.argv.includes('--verbose')) console.log('   ' + f + '  ' + before + ' → ' + out.length);
    }
  }

  console.log((APPLY ? 'ĐÃ GHI' : 'DRY-RUN') + ' | file đổi: ' + stat.changed + '/' + files.length);
  console.log('  script ngoài gỡ     : ' + stat.script);
  console.log('  link ngoài gỡ       : ' + stat.link);
  console.log('  noscript GTM gỡ     : ' + stat.noscript);
  console.log('  iframe GTM gỡ       : ' + stat.ext);
  console.log('  script inline gỡ    : ' + stat.inline);
  console.log('  url() ckeditor -> none: ' + stat.urlFn);
  console.log('  tham chiếu CDN đổi  : ' + stat.cdnRefs + ' (' + cdnMap.size + ' URL unique)');
  if (!APPLY) console.log('\nChạy lại với --apply để tải ảnh + ghi file.');
})();
