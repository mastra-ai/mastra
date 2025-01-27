// Not transpiled with TypeScript or Babel, so use plain Es6/Node.js!

const path = require('path');

/**
 * @type {import('dts-cli').DtsConfig}
 */
module.exports = {
  // This function will run for each entry/format/env combination
  rollup(config, options) {
    config.input.logger = path.resolve(__dirname, 'src/logger/index.ts');

    config.output.entryFileNames = '[name].esm.js'
    return config; // always return a config.
  },
};
