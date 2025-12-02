import { i as internalFixDefaultCJSExports } from './utils-DwzdDEfz.js';
import 'magic-string';
import 'mlly';

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
      return matcher(info) ? internalFixDefaultCJSExports(code, info, options) : void 0;
    }
  };
}

export { FixDtsDefaultCjsExportsPlugin, cjsExportsDtsMatcher, defaultCjsExportsDtsMatcher };
