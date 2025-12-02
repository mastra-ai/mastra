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
var directoryStructure_exports = {};
__export(directoryStructure_exports, {
  buildComponentDirectory: () => buildComponentDirectory,
  isComponentDirectory: () => isComponentDirectory,
  qualifiedDefinitionPath: () => qualifiedDefinitionPath,
  toAbsolutePath: () => toAbsolutePath,
  toComponentDefinitionPath: () => toComponentDefinitionPath
});
module.exports = __toCommonJS(directoryStructure_exports);
var import_path = __toESM(require("path"), 1);
var import_constants = require("../constants.js");
var import_config = require("../../config.js");
function qualifiedDefinitionPath(directory, workingDir = ".") {
  const definitionPath = import_path.default.relative(workingDir, directory.definitionPath);
  const posixDefinitionPath = definitionPath.split(import_path.default.sep).join(import_path.default.posix.sep);
  return `./${posixDefinitionPath}`;
}
function isComponentDirectory(ctx, directory, isRoot) {
  let isRootWithoutConfig = false;
  if (!ctx.fs.exists(directory)) {
    return {
      kind: "ok",
      component: {
        isRoot,
        path: import_path.default.resolve(directory),
        definitionPath: import_path.default.resolve(
          import_path.default.join(directory, import_constants.DEFINITION_FILENAME_TS)
        ),
        isRootWithoutConfig: true
      }
    };
  }
  const dirStat = ctx.fs.stat(directory);
  if (!dirStat.isDirectory()) {
    return { kind: "err", why: `Not a directory` };
  }
  let filename = import_constants.DEFINITION_FILENAME_TS;
  let definitionPath = import_path.default.resolve(import_path.default.join(directory, filename));
  if (!ctx.fs.exists(definitionPath)) {
    filename = import_constants.DEFINITION_FILENAME_JS;
    definitionPath = import_path.default.resolve(import_path.default.join(directory, filename));
  }
  if (!ctx.fs.exists(definitionPath)) {
    isRootWithoutConfig = true;
  } else {
    const definitionStat = ctx.fs.stat(definitionPath);
    if (!definitionStat.isFile()) {
      return {
        kind: "err",
        why: `Component definition ${filename} isn't a file`
      };
    }
  }
  return {
    kind: "ok",
    component: {
      isRoot,
      path: import_path.default.resolve(directory),
      definitionPath,
      isRootWithoutConfig
    }
  };
}
async function buildComponentDirectory(ctx, definitionPath) {
  const convexDir = import_path.default.resolve(await (0, import_config.getFunctionsDirectoryPath)(ctx));
  const isRoot = import_path.default.dirname(import_path.default.resolve(definitionPath)) === convexDir;
  const isComponent = isComponentDirectory(
    ctx,
    import_path.default.dirname(definitionPath),
    isRoot
  );
  if (isComponent.kind === "err") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Invalid component directory (${isComponent.why}): ${import_path.default.dirname(definitionPath)}`
    });
  }
  return isComponent.component;
}
function toComponentDefinitionPath(rootComponent, component) {
  const relativePath = import_path.default.relative(
    rootComponent.path,
    component.path
  );
  const definitionPath = relativePath.split(import_path.default.sep).join(import_path.default.posix.sep);
  return definitionPath;
}
function toAbsolutePath(rootComponent, componentDefinitionPath) {
  const relativePath = componentDefinitionPath.split(import_path.default.posix.sep).join(import_path.default.sep);
  return import_path.default.normalize(import_path.default.join(rootComponent.path, relativePath));
}
//# sourceMappingURL=directoryStructure.js.map
