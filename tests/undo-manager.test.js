const test = require('node:test');
const assert = require('node:assert/strict');

function createUndoManager(maxSize = 50) {
  global.window = { ChartApp: {} };

  const modulePath = require.resolve('../src-js/undo.js');
  delete require.cache[modulePath];
  require(modulePath);

  const buttonStates = [];
  const manager = new window.ChartApp.UndoManager(maxSize, (canUndo, canRedo) => {
    buttonStates.push({ canUndo, canRedo });
  });

  return { manager, buttonStates };
}

test('refresh enables undo for a live change and undo/redo round-trips it', () => {
  const { manager, buttonStates } = createUndoManager();
  const baseline = { title: 'Original' };
  const changed = { title: 'Changed' };

  manager.push(baseline);
  manager.refresh(changed);

  assert.deepEqual(manager.stack, [baseline]);
  assert.deepEqual(buttonStates.at(-1), { canUndo: true, canRedo: false });
  assert.deepEqual(manager.undo(changed), baseline);
  assert.deepEqual(buttonStates.at(-1), { canUndo: false, canRedo: true });
  assert.deepEqual(manager.redo(), changed);
  assert.deepEqual(buttonStates.at(-1), { canUndo: true, canRedo: false });
});

test('refresh after undo clears redo when the live state diverges', () => {
  const { manager, buttonStates } = createUndoManager();
  const baseline = { title: 'Original' };
  const changed = { title: 'Changed' };
  const divergent = { title: 'Divergent' };

  manager.push(baseline);
  manager.refresh(changed);
  manager.undo(changed);
  manager.refresh(divergent);

  assert.deepEqual(buttonStates.at(-1), { canUndo: true, canRedo: false });
  assert.equal(manager.redo(), null);
  assert.deepEqual(manager.undo(divergent), baseline);
  assert.deepEqual(manager.redo(), divergent);
});

test('refresh keeps undo disabled when the live state is unchanged', () => {
  const { manager, buttonStates } = createUndoManager();
  const baseline = { title: 'Original', sections: [] };

  manager.push(baseline);
  manager.refresh({ title: 'Original', sections: [] });

  assert.deepEqual(buttonStates.at(-1), { canUndo: false, canRedo: false });
  assert.equal(manager.undo(baseline), null);
});

test('history remains capped at the configured maximum', () => {
  const { manager } = createUndoManager(50);

  for (let value = 0; value < 60; value++) {
    manager.push({ value });
  }

  assert.equal(manager.stack.length, 50);
  assert.equal(manager.index, 49);
  assert.deepEqual(manager.stack[0], { value: 10 });
  assert.deepEqual(manager.stack[49], { value: 59 });
});

test('history remains capped when undo captures the pending live state', () => {
  const { manager } = createUndoManager(2);

  manager.push({ value: 0 });
  manager.push({ value: 1 });
  manager.refresh({ value: 2 });

  assert.deepEqual(manager.undo({ value: 2 }), { value: 1 });
  assert.equal(manager.stack.length, 2);
  assert.equal(manager.index, 0);
  assert.deepEqual(manager.stack, [{ value: 1 }, { value: 2 }]);
  assert.deepEqual(manager.redo(), { value: 2 });
});
