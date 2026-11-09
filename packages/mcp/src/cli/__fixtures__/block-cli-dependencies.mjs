import { createRequire, register, syncBuiltinESMExports } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const original = Module._load;
function blocked(id) {
  return /^(tsx|json-schema-to-typescript)(\/|$)/.test(id);
}
Module._load = function (id, ...args) {
  if (blocked(id)) throw new Error(`Unexpected CLI dependency: ${id}`);
  return original.call(this, id, ...args);
};
syncBuiltinESMExports();
register(new URL('./block-cli-resolver.mjs', import.meta.url));
