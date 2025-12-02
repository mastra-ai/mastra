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
var versionApi_exports = {};
__export(versionApi_exports, {
  downloadLatestCursorRules: () => downloadLatestCursorRules,
  getVersion: () => getVersion,
  validateVersionResult: () => validateVersionResult
});
module.exports = __toCommonJS(versionApi_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_version = require("../version.js");
const VERSION_ENDPOINT = "https://version.convex.dev/v1/version";
const CURSOR_RULES_ENDPOINT = "https://version.convex.dev/v1/cursor_rules";
const HEADERS = {
  "Convex-Client": `npm-cli-${import_version.version}`
};
async function getVersion() {
  try {
    const req = await fetch(VERSION_ENDPOINT, {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureException(
        new Error(`Failed to fetch version: status = ${req.status}`)
      );
      return null;
    }
    const json = await req.json();
    return validateVersionResult(json);
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
function validateVersionResult(json) {
  if (typeof json !== "object" || json === null) {
    Sentry.captureMessage("Invalid version result", "error");
    return null;
  }
  if (typeof json.message !== "string" && json.message !== null) {
    Sentry.captureMessage("Invalid version.message result", "error");
    return null;
  }
  if (typeof json.cursorRulesHash !== "string" && json.cursorRulesHash !== null) {
    Sentry.captureMessage("Invalid version.cursorRulesHash result", "error");
    return null;
  }
  return json;
}
async function downloadLatestCursorRules() {
  try {
    const req = await fetch(CURSOR_RULES_ENDPOINT, {
      headers: HEADERS
    });
    if (!req.ok) {
      Sentry.captureMessage(
        `Failed to fetch Cursor rules: status = ${req.status}`
      );
      return null;
    }
    const text = await req.text();
    return text;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
//# sourceMappingURL=versionApi.js.map
