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
var prompts_exports = {};
__export(prompts_exports, {
  promptOptions: () => promptOptions,
  promptSearch: () => promptSearch,
  promptString: () => promptString,
  promptYesNo: () => promptYesNo
});
module.exports = __toCommonJS(prompts_exports);
var import_inquirer = __toESM(require("inquirer"), 1);
var import_log = require("../../../bundler/log.js");
const promptString = async (ctx, options) => {
  if (process.stdin.isTTY) {
    const result = (await import_inquirer.default.prompt([
      {
        type: "input",
        name: "result",
        message: options.message,
        default: options.default
      }
    ])).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`
    });
  }
};
const promptOptions = async (ctx, options) => {
  if (process.stdin.isTTY) {
    const result = (await import_inquirer.default.prompt([
      {
        // In the Convex mono-repo, `list` seems to cause the command to not
        // respond to CTRL+C while `search-list` does not.
        type: process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO ? "search-list" : "list",
        name: "result",
        message: options.message,
        ...options.prefix ? { prefix: options.prefix } : {},
        ...options.suffix ? { suffix: options.suffix } : {},
        choices: options.choices,
        default: options.default
      }
    ])).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`
    });
  }
};
const promptSearch = async (ctx, options) => {
  if (process.stdin.isTTY) {
    const result = (await import_inquirer.default.prompt([
      {
        type: "search-list",
        name: "result",
        message: options.message,
        choices: options.choices,
        default: options.default
      }
    ])).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`
    });
  }
};
const promptYesNo = async (ctx, options) => {
  if (process.stdin.isTTY) {
    const { result } = await import_inquirer.default.prompt([
      {
        type: "confirm",
        name: "result",
        message: options.message,
        default: options.default,
        ...options.prefix ? { prefix: options.prefix } : {}
      }
    ]);
    return result;
  } else {
    (0, import_log.logOutput)(options.message);
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`
    });
  }
};
//# sourceMappingURL=prompts.js.map
