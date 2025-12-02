"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var updates_exports = {};
__export(updates_exports, {
  checkVersion: () => checkVersion
});
module.exports = __toCommonJS(updates_exports);
var import_log = require("../../bundler/log.js");
var import_cursorRules = require("./cursorRules.js");
var import_versionApi = require("./versionApi.js");
async function checkVersion() {
  const version = await (0, import_versionApi.getVersion)();
  if (version === null) {
    return;
  }
  if (version.message) {
    (0, import_log.logMessage)(version.message);
  }
  if (version.cursorRulesHash) {
    await (0, import_cursorRules.autoUpdateCursorRules)(version.cursorRulesHash);
  }
}
//# sourceMappingURL=updates.js.map
