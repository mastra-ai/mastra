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
var sentry_exports = {};
__export(sentry_exports, {
  SENTRY_DSN: () => SENTRY_DSN,
  initSentry: () => initSentry
});
module.exports = __toCommonJS(sentry_exports);
var import_tracing = require("@sentry/tracing");
var import_config = require("../config.js");
var Sentry = __toESM(require("@sentry/node"), 1);
var import__ = require("../../../index.js");
var import_util = require("util");
const SENTRY_DSN = "https://f9fa0306e3d540079cf40ce8c2ad9644@o1192621.ingest.sentry.io/6390839";
function initSentry() {
  if ((!process.env.CI || process.env.VERCEL === "1") && import_config.provisionHost === import_config.productionProvisionHost) {
    Sentry.init({
      dsn: SENTRY_DSN,
      release: "cli@" + import__.version,
      tracesSampleRate: 0.2,
      beforeBreadcrumb: (breadcrumb) => {
        if (breadcrumb.message) {
          breadcrumb.message = (0, import_util.stripVTControlCharacters)(breadcrumb.message);
        }
        return breadcrumb;
      }
    });
  }
}
//# sourceMappingURL=sentry.js.map
