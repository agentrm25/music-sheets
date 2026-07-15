const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SEED_PATH = path.join(ROOT, 'qa', 'native-seed.js');
const PREPARE_PATH = path.join(ROOT, 'script', 'prepare_qa_dist.js');
const RUNNER_PATH = path.join(ROOT, 'script', 'build_and_run.sh');

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  clear() {
    this.data.clear();
  }
}

test('native QA seed creates the bounded production-scale synthetic corpus once', () => {
  assert.equal(fs.existsSync(SEED_PATH), true, 'Expected the QA-only native seed script');
  const source = fs.readFileSync(SEED_PATH, 'utf8');
  const localStorage = new MemoryStorage();
  const context = vm.createContext({ localStorage });

  vm.runInContext(source, context, { filename: SEED_PATH });

  const charts = JSON.parse(localStorage.getItem('chart-creator-saved'));
  const groups = JSON.parse(localStorage.getItem('chart-creator-groups'));
  const collected = JSON.parse(localStorage.getItem('chart-creator-collected-sections'));
  const draft = JSON.parse(localStorage.getItem('chart-creator-state'));
  const settings = JSON.parse(localStorage.getItem('chart-creator-settings'));
  assert.equal(charts.length, 300);
  assert.equal(groups.length, 30);
  assert.equal(collected.length, 120);
  assert.equal(charts.filter(chart => chart.versions.length === 3).length, 30);
  assert.equal(draft.sections.length, 50);
  assert.equal(draft.sections.reduce((sum, section) => sum + section.lines.length, 0), 400);
  assert.deepEqual(settings, { saveDirectory: '', theme: 'dark' });
  assert.ok(charts.every(chart => chart.name.startsWith('QA Chart ')));

  localStorage.setItem('chart-creator-saved', '[]');
  vm.runInContext(source, context, { filename: SEED_PATH });
  assert.equal(localStorage.getItem('chart-creator-saved'), '[]');

  localStorage.clear();
  vm.runInContext(source, context, { filename: SEED_PATH });
  assert.equal(JSON.parse(localStorage.getItem('chart-creator-saved')).length, 300);
  assert.equal(JSON.parse(localStorage.getItem('chart-creator-groups')).length, 30);
  assert.equal(JSON.parse(localStorage.getItem('chart-creator-collected-sections')).length, 120);
});

test('QA runner exposes an explicit reset scoped to the QA WebKit store', () => {
  const runner = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(runner, /BUNDLE_ID="com\.chartcreator\.music\.qa"/);
  assert.match(runner, /QA_WEBKIT_DIR="\$HOME\/Library\/WebKit\/\$BUNDLE_ID"/);
  assert.match(runner, /reset_qa_data\(\)/);
  assert.match(runner, /"\$QA_WEBKIT_DIR" != "\$HOME\/Library\/WebKit\/com\.chartcreator\.music\.qa"/);
  assert.match(runner, /--reset\|reset\)/);
  assert.match(runner, /reset_qa_data/);
});

test('QA runner keeps build output and process control isolated', () => {
  const runner = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(runner, /QA_TARGET_DIR="\$ROOT_DIR\/src-tauri\/target\/qa-approval-b"/);
  assert.match(runner, /CARGO_TARGET_DIR="\$QA_TARGET_DIR"/);
  assert.match(runner, /--config "\$QA_CONFIG"/);
  assert.match(runner, /--bundles app/);
  assert.match(runner, /--no-sign/);
  assert.match(runner, /pgrep -fx "\$binary"/);
  assert.match(runner, /pgrep -fx "\$APP_BINARY"/);
  assert.doesNotMatch(runner, /pkill/);
});

test('QA dist preparation injects the seed once without changing production dist', t => {
  assert.equal(fs.existsSync(PREPARE_PATH), true, 'Expected the QA dist preparation script');
  const { prepareQaDist } = require(PREPARE_PATH);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'music-sheets-qa-dist-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tempRoot, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'qa'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'src-tauri'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'src-js'), { recursive: true });
  for (const file of ['index.html', 'app.js', 'style.css', 'icon.png', 'jspdf.umd.min.js']) {
    fs.writeFileSync(path.join(tempRoot, file), file === 'index.html' ? '<script src="./app.js"></script>' : file);
  }
  fs.writeFileSync(path.join(tempRoot, 'src-js', 'state.js'), 'source state');
  fs.writeFileSync(path.join(tempRoot, 'dist', 'index.html'), 'PRODUCTION DIST SENTINEL');
  fs.writeFileSync(path.join(tempRoot, 'dist', 'production-only.txt'), 'must remain byte-for-byte unchanged');
  fs.writeFileSync(path.join(tempRoot, 'qa', 'native-seed.js'), 'window.QA_SEED = true;');
  fs.writeFileSync(path.join(tempRoot, 'src-tauri', 'tauri.qa.conf.json'), JSON.stringify({
    identifier: 'com.chartcreator.music.qa'
  }));
  const productionDistBefore = fs.readdirSync(path.join(tempRoot, 'dist')).sort().map(file => [
    file,
    fs.readFileSync(path.join(tempRoot, 'dist', file))
  ]);

  prepareQaDist(tempRoot);
  prepareQaDist(tempRoot);

  const index = fs.readFileSync(path.join(tempRoot, 'dist-qa', 'index.html'), 'utf8');
  assert.equal((index.match(/qa-native-seed\.js/g) || []).length, 1);
  assert.ok(index.indexOf('qa-native-seed.js') < index.indexOf('app.js'));
  assert.equal(fs.readFileSync(path.join(tempRoot, 'dist-qa', 'qa-native-seed.js'), 'utf8'), 'window.QA_SEED = true;');
  const productionDistAfter = fs.readdirSync(path.join(tempRoot, 'dist')).sort().map(file => [
    file,
    fs.readFileSync(path.join(tempRoot, 'dist', file))
  ]);
  assert.deepEqual(productionDistAfter, productionDistBefore);

  fs.writeFileSync(path.join(tempRoot, 'src-tauri', 'tauri.qa.conf.json'), JSON.stringify({
    identifier: 'com.chartcreator.music'
  }));
  assert.throws(() => prepareQaDist(tempRoot), /Refusing to prepare QA dist/);
});

test('only the QA Tauri config prepares the native seed bundle', () => {
  const production = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  const qa = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri', 'tauri.qa.conf.json'), 'utf8'));
  assert.equal(production.build.beforeBuildCommand, 'node build.js');
  assert.equal(production.build.beforeDevCommand, 'node build.js && npx -y http-server dist -p 1420');
  assert.equal(qa.build.frontendDist, '../dist-qa');
  assert.equal(qa.build.beforeBuildCommand, 'node script/prepare_qa_dist.js');
  assert.equal(qa.build.beforeDevCommand, 'node script/prepare_qa_dist.js && npx -y http-server dist-qa -a 127.0.0.1 -p 1421');
});

test('normal asset builds remove QA-only seed files before copying source', t => {
  const { buildAssets } = require(path.join(ROOT, 'build.js'));
  assert.equal(typeof buildAssets, 'function');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'music-sheets-build-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tempRoot, 'src-js'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'dist'), { recursive: true });
  for (const file of ['index.html', 'app.js', 'style.css', 'icon.png', 'jspdf.umd.min.js']) {
    fs.writeFileSync(path.join(tempRoot, file), file);
  }
  fs.writeFileSync(path.join(tempRoot, 'src-js', 'state.js'), 'source state');
  fs.writeFileSync(path.join(tempRoot, 'dist', 'qa-native-seed.js'), 'must not survive');

  buildAssets(tempRoot);

  assert.equal(fs.existsSync(path.join(tempRoot, 'dist', 'qa-native-seed.js')), false);
  assert.equal(fs.readFileSync(path.join(tempRoot, 'dist', 'src-js', 'state.js'), 'utf8'), 'source state');
});
