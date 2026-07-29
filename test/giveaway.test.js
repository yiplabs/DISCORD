const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('restart-unsafe giveaways are not shipped in production', () => {
  const commandDirectory = path.join(
    __dirname,
    '../tommyyipxyz-hub-bot-v2/src/commands'
  );
  const productionCommands = fs.readdirSync(commandDirectory);

  assert.equal(productionCommands.includes('giveaway.js'), false);
});
