const { readFileSync } = require('fs');
const JSON11 = require('./parse.js');

const handler = function (module, filename) {
  const content = readFileSync(filename, 'utf8');
  try {
    module.exports = JSON11.parse(content);
  } catch (err) {
    err.message = filename + ': ' + err.message;
    throw err;
  }
};

require.extensions['.json11'] = handler;
require.extensions['.json5'] = handler;

