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
var cursorRules_exports = {};
__export(cursorRules_exports, {
  autoUpdateCursorRules: () => autoUpdateCursorRules
});
module.exports = __toCommonJS(cursorRules_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_versionApi = require("./versionApi.js");
var import_path = __toESM(require("path"), 1);
var import_hash = require("./utils/hash.js");
var import_chalk = __toESM(require("chalk"), 1);
var import_fs = require("fs");
var import_log = require("../../bundler/log.js");
async function autoUpdateCursorRules(expectedRulesHash) {
  if (expectedRulesHash === null) {
    return;
  }
  const currentRulesHash = await getCurrentRulesHash();
  if (currentRulesHash === null) {
    return;
  }
  if (currentRulesHash !== expectedRulesHash) {
    const rules = await (0, import_versionApi.downloadLatestCursorRules)();
    if (rules === null) {
      return;
    }
    try {
      const rulesPath = getRulesPath();
      await import_fs.promises.writeFile(rulesPath, rules, "utf8");
      (0, import_log.logMessage)(
        `${import_chalk.default.green(`\u2714`)} Automatically updated the Convex Cursor rules to the latest version.`
      );
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}
async function getCurrentRulesHash() {
  const rulesPath = getRulesPath();
  let content;
  try {
    content = await import_fs.promises.readFile(rulesPath, "utf8");
  } catch {
    return null;
  }
  return (0, import_hash.hashSha256)(content);
}
function getRulesPath() {
  return import_path.default.join(process.cwd(), ".cursor", "rules", "convex_rules.mdc");
}
//# sourceMappingURL=cursorRules.js.map
