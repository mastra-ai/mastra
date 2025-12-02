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
var functionSpec_exports = {};
__export(functionSpec_exports, {
  functionSpecForDeployment: () => functionSpecForDeployment
});
module.exports = __toCommonJS(functionSpec_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_run = require("./run.js");
async function functionSpecForDeployment(ctx, options) {
  const functions = await (0, import_run.runSystemQuery)(ctx, {
    deploymentUrl: options.deploymentUrl,
    adminKey: options.adminKey,
    functionName: "_system/cli/modules:apiSpec",
    componentPath: void 0,
    args: {}
  });
  const url = await (0, import_run.runSystemQuery)(ctx, {
    deploymentUrl: options.deploymentUrl,
    adminKey: options.adminKey,
    functionName: "_system/cli/convexUrl:cloudUrl",
    componentPath: void 0,
    args: {}
  });
  const output = JSON.stringify({ url, functions }, null, 2);
  if (options.file) {
    const fileName = `function_spec_${Date.now().valueOf()}.json`;
    ctx.fs.writeUtf8File(fileName, output);
    (0, import_log.logOutput)(import_chalk.default.green(`Wrote function spec to ${fileName}`));
  } else {
    (0, import_log.logOutput)(output);
  }
}
//# sourceMappingURL=functionSpec.js.map
