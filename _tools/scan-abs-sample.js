// Mẫu 10 URL tuyệt đối theo từng thuộc tính (chỉ đọc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const out = { src: [], href: [], other: [], domain: [] };
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/https?:\/\/noritake\.myharavan\.com(\/[^"'\s<>)\\]*)?/gi)) {
    const before = html.slice(Math.max(0, m.index - 24), m.index);
    const attr = (before.match(/([a-z-]+)="$/i) || [])[1] || 'other';
    const arr = out[attr] || out.other;
    if (arr.length < 6) arr.push(f + '  |  …' + before.slice(-16) + ' → ' + m[0].slice(0, 95));
  }
}
for (const [k, v] of Object.entries(out)) {
  if (!v.length) continue;
  console.log('=== ' + k + ' ===');
  v.forEach(x => console.log('   ' + x));
}
