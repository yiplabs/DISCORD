const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ensureDatabaseDirectory,
} = require('../tommyyipxyz-hub-bot-v2/src/utils/database');

test('creates the ignored SQLite data directory in a fresh deployment image', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dvc-bot-database-')
  );
  const databasePath = path.join(temporaryRoot, 'src', 'data', 'hub.db');

  try {
    ensureDatabaseDirectory(databasePath);
    assert.equal(fs.existsSync(path.dirname(databasePath)), true);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
