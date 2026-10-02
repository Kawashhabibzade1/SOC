const fs = require('fs');
const path = require('path');
const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
};
const files = walk('./src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let modified = false;
  
  const pattern = /const GATEWAY_URL = '';/g;
  if (pattern.test(content)) {
    content = content.replace(pattern, "const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://heimserver.tail2ad9cd.ts.net';");
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
