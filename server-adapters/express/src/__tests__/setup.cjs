const Module = require('module');
const path = require('node:path');
const createRequire = Module.createRequire;
const requireFromExpress = createRequire(path.resolve(__dirname, '..', '..', 'package.json'));

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === '@paralleldrive/cuid2') {
    return path.resolve(__dirname, './cuid2-stub.cjs');
  }
  if (request === 'formidable') {
    return path.resolve(__dirname, './formidable-stub.cjs');
  }
  if (request === 'superagent/src/node/index.js') {
    return path.resolve(requireFromExpress.resolve('superagent/lib/node/index.js'));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
