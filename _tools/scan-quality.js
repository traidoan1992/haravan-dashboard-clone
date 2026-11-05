// Phân loại chất lượng từng trang clone: OK / IFRAME_ONLY / TRUNCATED / SHELL (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const APP_HOSTS = /(customers|reports|web|shopee|tiki|google-shopping|pos)\.haravan\.(app|com)/i;

const buckets = {};
const list = { IFRAME_ONLY: [], TRUNCATED: [], SHELL: [], NO_NOTE: [] };
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const appFrame = [...html.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)].map(m => m[1]).some(u => APP_HOSTS.test(u));
  const shell = /^Omni\s*~\s*Haravan$/i.test(title);

  let cls;
  if (appFrame) cls = 'IFRAME_ONLY';
  else if (shell) cls = 'SHELL';
  else if (text.length < 1200) cls = 'TRUNCATED';
  else cls = 'OK';

  buckets[cls] = (buckets[cls] || 0) + 1;
  if (list[cls]) list[cls].push(f + '  (text=' + text.length + ')');

  if (appFrame && !/clone-frame-note\.js/.test(html)) list.NO_NOTE.push(f);
}

console.log(JSON.stringify(buckets, null, 1));
console.log('\n--- IFRAME_ONLY (không thể clone nội dung): ' + list.IFRAME_ONLY.length + ' ---');
list.IFRAME_ONLY.forEach(x => console.log('   ' + x));
console.log('\n--- SHELL (title chưa đổi = chụp quá sớm): ' + list.SHELL.length + ' ---');
list.SHELL.forEach(x => console.log('   ' + x));
console.log('\n--- TRUNCATED (text < 1200, không phải iframe): ' + list.TRUNCATED.length + ' ---');
list.TRUNCATED.slice(0, 40).forEach(x => console.log('   ' + x));
console.log('\n--- Trang iframe app THIẾU clone-frame-note.js: ' + list.NO_NOTE.length + ' ---');
list.NO_NOTE.forEach(x => console.log('   ' + x));
