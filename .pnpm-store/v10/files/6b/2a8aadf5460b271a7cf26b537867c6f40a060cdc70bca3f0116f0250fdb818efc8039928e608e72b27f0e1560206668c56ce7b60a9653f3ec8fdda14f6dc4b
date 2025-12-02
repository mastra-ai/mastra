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
var debugBundlePath_exports = {};
__export(debugBundlePath_exports, {
  handleDebugBundlePath: () => handleDebugBundlePath
});
module.exports = __toCommonJS(debugBundlePath_exports);
var import_path = __toESM(require("path"), 1);
async function handleDebugBundlePath(ctx, debugBundleDir, config) {
  if (!ctx.fs.exists(debugBundleDir)) {
    ctx.fs.mkdir(debugBundleDir);
  } else if (!ctx.fs.stat(debugBundleDir).isDirectory()) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Path \`${debugBundleDir}\` is not a directory. Please choose an empty directory for \`--debug-bundle-path\`.`
    });
  } else if (ctx.fs.listDir(debugBundleDir).length !== 0) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Directory \`${debugBundleDir}\` is not empty. Please remove it or choose an empty directory for \`--debug-bundle-path\`.`
    });
  }
  ctx.fs.writeUtf8File(
    import_path.default.join(debugBundleDir, "fullConfig.json"),
    JSON.stringify(config)
  );
  for (const moduleInfo of config.modules) {
    const trimmedPath = moduleInfo.path.endsWith(".js") ? moduleInfo.path.slice(0, moduleInfo.path.length - ".js".length) : moduleInfo.path;
    const environmentDir = import_path.default.join(debugBundleDir, moduleInfo.environment);
    ctx.fs.mkdir(import_path.default.dirname(import_path.default.join(environmentDir, `${trimmedPath}.js`)), {
      allowExisting: true,
      recursive: true
    });
    ctx.fs.writeUtf8File(
      import_path.default.join(environmentDir, `${trimmedPath}.js`),
      moduleInfo.source
    );
    if (moduleInfo.sourceMap !== void 0) {
      ctx.fs.writeUtf8File(
        import_path.default.join(environmentDir, `${trimmedPath}.js.map`),
        moduleInfo.sourceMap
      );
    }
  }
}
//# sourceMappingURL=debugBundlePath.js.map
