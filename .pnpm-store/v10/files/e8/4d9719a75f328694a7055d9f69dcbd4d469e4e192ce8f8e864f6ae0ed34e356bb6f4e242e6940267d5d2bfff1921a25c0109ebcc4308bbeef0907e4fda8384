'use strict';

var utils = require('./utils-CylcaoNQ.cjs');
require('magic-string');
require('mlly');

function cjsExportsDtsMatcher(info) {
  return info.type === "chunk" && info.exports?.length > 0 && info.exports.includes("default") && /\.d\.c?ts$/.test(info.fileName);
}
function defaultCjsExportsDtsMatcher(info) {
  return cjsExportsDtsMatcher(info) && info.isEntry;
}
function FixDtsDefaultCjsExportsPlugin(options = {}) {
  const { matcher = defaultCjsExportsDtsMatcher } = options;
  return {
    name: "fix-dts-default-cjs-exports-plugin",
    renderChunk(code, info) {
      return matcher(info) ? utils.internalFixDefaultCJSExports(code, info, options) : void 0;
    }
  };
}

exports.FixDtsDefaultCjsExportsPlugin = FixDtsDefaultCjsExportsPlugin;
exports.cjsExportsDtsMatcher = cjsExportsDtsMatcher;
exports.defaultCjsExportsDtsMatcher = defaultCjsExportsDtsMatcher;
