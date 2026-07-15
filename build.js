const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function buildAssets(rootDir = __dirname, outputDirectory = 'dist') {
  const dist = path.join(rootDir, outputDirectory);
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  const filesToCopy = [
    'index.html',
    'app.js',
    'style.css',
    'icon.png',
    'src-js',
    'jspdf.umd.min.js'
  ];

  filesToCopy.forEach(file => {
    const src = path.join(rootDir, file);
    const dest = path.join(dist, file);
    if (fs.existsSync(src)) {
      copyRecursiveSync(src, dest);
    }
  });
}

if (require.main === module) {
  buildAssets();
  console.log('Build assets copied to dist/');
}

module.exports = { buildAssets };
