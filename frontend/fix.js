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
  if (content.includes("'http://localhost:3001'")) {
    content = content.replace(/'http:\/\/localhost:3001'/g, '`http://${window.location.hostname}:3001`');
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
