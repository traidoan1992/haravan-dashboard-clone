// Chạy toàn bộ bước hậu xử lý sau khi crawl xong
const { execSync } = require('child_process');
const path = require('path');

const steps = [
  ['relink.js', '--apply'],
  ['localize-new.js', '--apply'],
  ['fix-rows.js', '--apply'],
  ['check-links.js'],
  ['smoke-http.js'],
  ['shell-list.js']
];

for (const [file, ...args] of steps) {
  const cmd = ['node', path.join(__dirname, file), ...args].join(' ');
  console.log('\n=== ' + file + ' ' + args.join(' ') + ' ===');
  try {
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    console.log(out.split('\n').slice(0, 40).join('\n'));
  } catch (e) {
    console.log('LỖI: ' + (e.stdout || e.message).toString().split('\n').slice(0, 12).join('\n'));
  }
}
