// In (dạng text) dòng <tr> chứa một chuỗi cần tìm, kèm danh sách href trong dòng đó.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const file = process.argv[2];
const needles = process.argv.slice(3);
const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
const rows = html.match(/<tr\b[\s\S]*?<\/tr>/g) || [];
rows.forEach((r, i) => {
  for (const n of needles) {
    if (!r.includes(n)) continue;
    const hrefs = [...new Set([...r.matchAll(/href="([^"]+)"/g)].map(m => m[1]))];
    const text = r.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 260);
    console.log(`row#${i} [${n}] hrefs=${JSON.stringify(hrefs.slice(0, 5))}`);
    console.log('   text: ' + text);
  }
});
