// Run before publishing a change:  node tools/bump-version.js
// Gives every script and stylesheet a new ?v= number, so browsers load the
// new files instead of mixing them with cached old ones (GitHub Pages lets
// browsers cache files for 10 minutes).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 12); // e.g. 202611231530

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

const files = [path.join(root, 'index.html'), ...walk(path.join(root, 'js'))];
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    // import ... from './x.js'  and  import('./x.js')  (relative imports only)
    .replace(/((?:from\s+|import\s*\(\s*)['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g, `$1$2?v=${version}$3`)
    // <script src="js/app.js?v=..."> and <link href="css/styles.css?v=...">
    .replace(/((?:src|href)=")((?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g, `$1$2?v=${version}$3`);
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}
console.log(`Version ${version} set in ${changed} files`);
