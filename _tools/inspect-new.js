// Kiểm tra nhanh 1 file mới chụp: còn script bundle của site không, và link draft còn tuyệt đối bao nhiêu
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'haravan_dashboard_html');
const f = process.argv[2] || 'draft_orders.html';
const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
const scripts = [...t.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
console.log('script tags:', scripts.length);
scripts.filter(s => /assets\/|noritake\.myharavan/.test(s)).forEach(s => console.log('   ' + s.slice(0, 130)));
const abs = [...new Set([...t.matchAll(/href="(https:\/\/noritake\.myharavan\.com\/admin\/[^"]+)"/g)].map(m => m[1]))];
console.log('link tuyệt đối còn lại:', abs.length, 'khác nhau:', abs.length);
abs.slice(0, 6).forEach(u => console.log('   ' + u));
const local = [...new Set([...t.matchAll(/href="(draft_orders_[0-9a-f]+\.html)"/g)].map(m => m[1]))];
console.log('link tới đơn nháp local:', local.length, local.slice(0, 3).join(', '));
