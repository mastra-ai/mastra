"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var fsUtils_exports = {};
__export(fsUtils_exports, {
  recursivelyCopy: () => recursivelyCopy,
  recursivelyDelete: () => recursivelyDelete
});
module.exports = __toCommonJS(fsUtils_exports);
var import_log = require("../../bundler/log.js");
var import_path = __toESM(require("path"), 1);
function recursivelyDelete(ctx, deletePath, opts) {
  const dryRun = !!opts?.dryRun;
  let st;
  try {
    st = ctx.fs.stat(deletePath);
  } catch (err) {
    if (err.code === "ENOENT" && opts?.force) {
      return;
    }
    throw err;
  }
  if (st.isDirectory()) {
    for (const entry of ctx.fs.listDir(deletePath)) {
      recursivelyDelete(ctx, import_path.default.join(deletePath, entry.name), opts);
    }
    if (dryRun) {
      (0, import_log.logOutput)(`Command would delete directory: ${deletePath}`);
      return;
    }
    try {
      ctx.fs.rmdir(deletePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  } else {
    if (dryRun) {
      (0, import_log.logOutput)(`Command would delete file: ${deletePath}`);
      return;
    }
    try {
      ctx.fs.unlink(deletePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
async function recursivelyCopy(ctx, nodeFs, src, dest) {
  const st = nodeFs.stat(src);
  if (st.isDirectory()) {
    nodeFs.mkdir(dest, { recursive: true });
    for (const entry of nodeFs.listDir(src)) {
      await recursivelyCopy(
        ctx,
        nodeFs,
        import_path.default.join(src, entry.name),
        import_path.default.join(dest, entry.name)
      );
    }
  } else {
    await nodeFs.writeFileStream(dest, nodeFs.createReadStream(src, {}));
  }
}
//# sourceMappingURL=fsUtils.js.map
