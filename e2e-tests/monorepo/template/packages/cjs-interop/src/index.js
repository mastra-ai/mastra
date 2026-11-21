const esmValue = require('./esm-value.mjs');

module.exports = {
  describeInterop: name => esmValue.default(name),
  prefix: esmValue.prefix,
};
