const fs = require('fs');
const a = 'C:\\Program Files (x86)\\Microsoft Edge\\Application\\msedge.exe';
const b = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
console.log('a', JSON.stringify(a), fs.existsSync(a));
console.log('b', JSON.stringify(b), fs.existsSync(b));
