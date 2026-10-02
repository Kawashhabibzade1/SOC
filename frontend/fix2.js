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
  
  // Pattern we wrote earlier
  const pattern1 = /const GATEWAY_URL = process\.env\.NEXT_PUBLIC_GATEWAY_URL \|\| `http:\/\/\$\{window\.location\.hostname\}:3001`;/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, "const GATEWAY_URL = '';");
    modified = true;
  }
  // Alternate pattern
  const pattern2 = /const GATEWAY_URL = process\.env\.NEXT_PUBLIC_GATEWAY_URL \|\| 'http:\/\/localhost:3001';/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, "const GATEWAY_URL = '';");
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
