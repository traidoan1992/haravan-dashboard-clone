// Khảo sát cấu trúc dòng bảng: mỗi <tr> có input id (ID bản ghi) và những href nào.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');

const targets = process.argv.slice(2);
for (const f of targets) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/g) || [];
  let withId = 0, withA = 0;
  const samples = [];
  for (const r of rows) {
    const idm = /<input[^>]*\bid="([0-9a-fA-F]{6,})"[^>]*type="checkbox"/.exec(r) || /<input[^>]*type="checkbox"[^>]*\bid="([0-9a-fA-F]{6,})"/.exec(r);
    const hrefs = [...r.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    if (idm) withId++;
    if (hrefs.length) withA++;
    if (idm && samples.length < 3) samples.push({ id: idm[1], hrefs: [...new Set(hrefs)] });
  }
  console.log(`\n=== ${f}: <tr>=${rows.length} cóInputId=${withId} cóHref=${withA}`);
  samples.forEach(s => console.log('   id=' + s.id + '  hrefs=' + JSON.stringify(s.hrefs.slice(0, 4))));
}
