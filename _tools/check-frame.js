// Kiểm tra header chặn nhúng của app customers/reports
const https = require('https');
const urls = [
  'https://customers.haravan.app/?orgid=200000296482&shop=noritake.myharavan.com&locale=vi&version=2',
  'https://reports.haravan.app/dashboard?orgid=200000296482&shop=noritake.myharavan.com&locale=vi&version=2'
];
for (const u of urls) {
  https.get(u, { headers: { 'user-agent': 'Mozilla/5.0' } }, r => {
    const h = r.headers;
    console.log('\n' + u.slice(0, 60) + '…  status=' + r.statusCode);
    console.log('   x-frame-options:', h['x-frame-options'] || '(không có)');
    const csp = h['content-security-policy'] || '';
    const fa = (csp.match(/frame-ancestors[^;]*/) || ['(không có)'])[0];
    console.log('   frame-ancestors:', fa);
    r.resume();
  }).on('error', e => console.log('LỖI ' + e.message));
}
