// Phân tích 4177 URL còn thiếu theo "hình dạng" để biết quy mô từng loại
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'missing-urls.json'), 'utf8'));
const groups = {};
const add = (k, u) => { (groups[k] = groups[k] || []).push(u); };
for (const { url } of data) {
  if (/^\/admin\/products\/collections\/[^/]+$/.test(url)) add('products · chi tiết nhóm SP', url);
  else if (/^\/admin\/products\/[^/]+\/variants\/[^/]+$/.test(url)) add('products · chi tiết biến thể', url);
  else if (/^\/admin\/products\/[^/]+\/variants_new$/.test(url)) add('products · tạo biến thể', url);
  else if (/^\/admin\/products\/[^/]+$/.test(url)) add('products · chi tiết sản phẩm', url);
  else if (/^\/admin\/products/.test(url)) add('products · khác', url);
  else if (/^\/admin\/orders\/[^/]+$/.test(url)) add('orders · chi tiết đơn', url);
  else if (/^\/admin\/orders/.test(url)) add('orders · khác', url);
  else if (/^\/admin\/customers\/[^/]+$/.test(url)) add('customers · chi tiết KH (iframe)', url);
  else if (/^\/admin\/customers/.test(url)) add('customers · khác', url);
  else if (/^\/admin\/inventory\/[^/]+\/[^/]+$/.test(url)) add('inventory · chi tiết phiếu', url);
  else if (/^\/admin\/inventory/.test(url)) add('inventory · khác', url);
  else if (/^\/admin\/draft_orders/.test(url)) add('draft_orders', url);
  else add(url.split('/')[2] + ' · khác', url);
}
const rows = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
console.log('Loại trang'.padEnd(36) + 'số lượng'.padStart(10) + '  ~thời gian'.padStart(12));
let total = 0;
for (const [k, v] of rows) {
  total += v.length;
  console.log(k.padEnd(36) + String(v.length).padStart(10) + ('  ~' + Math.round(v.length * 5 / 60) + ' phút').padStart(12));
}
console.log('-'.repeat(60));
console.log('TỔNG'.padEnd(36) + String(total).padStart(10) + ('  ~' + Math.round(total * 5 / 60) + ' phút').padStart(12));
