const fs = require('node:fs');
const path = require('node:path');
const { buildAssets } = require('../build.js');

const QA_IDENTIFIER = 'com.chartcreator.music.qa';
const SEED_TAG = '<script src="./qa-native-seed.js"></script>';
const APP_TAG = '<script src="./app.js"></script>';

function prepareQaDist(rootDir = path.resolve(__dirname, '..')) {
  const configPath = path.join(rootDir, 'src-tauri', 'tauri.qa.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.identifier !== QA_IDENTIFIER) {
    throw new Error(`Refusing to prepare QA dist for identifier ${config.identifier || '(missing)'}`);
  }

  buildAssets(rootDir, 'dist-qa');

  const indexPath = path.join(rootDir, 'dist-qa', 'index.html');
  const sourceSeedPath = path.join(rootDir, 'qa', 'native-seed.js');
  const distSeedPath = path.join(rootDir, 'dist-qa', 'qa-native-seed.js');
  let index = fs.readFileSync(indexPath, 'utf8');
  if (!index.includes(APP_TAG)) {
    throw new Error('Could not find the app script tag in dist-qa/index.html');
  }

  fs.copyFileSync(sourceSeedPath, distSeedPath);
  if (!index.includes(SEED_TAG)) {
    index = index.replace(APP_TAG, `${SEED_TAG}\n${APP_TAG}`);
    fs.writeFileSync(indexPath, index);
  }
}

if (require.main === module) {
  prepareQaDist();
  console.log('Prepared isolated native QA assets.');
}

module.exports = { prepareQaDist };
