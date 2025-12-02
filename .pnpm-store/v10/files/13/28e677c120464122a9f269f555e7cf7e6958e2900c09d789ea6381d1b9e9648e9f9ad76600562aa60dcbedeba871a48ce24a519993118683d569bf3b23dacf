"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var context_exports = {};
__export(context_exports, {
  oneoffContext: () => oneoffContext
});
module.exports = __toCommonJS(context_exports);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_fs = require("./fs.js");
var import_deploymentSelection = require("../cli/lib/deploymentSelection.js");
var import_log = require("./log.js");
async function flushAndExit(exitCode, err) {
  if (err) {
    Sentry.captureException(err);
  }
  await Sentry.close();
  return process.exit(exitCode);
}
class OneoffContextImpl {
  constructor() {
    __publicField(this, "_cleanupFns", {});
    __publicField(this, "fs", import_fs.nodeFs);
    __publicField(this, "deprecationMessagePrinted", false);
    __publicField(this, "spinner");
    __publicField(this, "_bigBrainAuth", null);
    __publicField(this, "crash", async (args) => {
      if (args.printedMessage !== null) {
        (0, import_log.logFailure)(args.printedMessage);
      }
      return await this.flushAndExit(args.exitCode, args.errForSentry);
    });
    __publicField(this, "flushAndExit", async (exitCode, err) => {
      (0, import_log.logVerbose)("Flushing and exiting, error:", err);
      if (err) {
        (0, import_log.logVerbose)(err.stack);
      }
      const cleanupFns = this._cleanupFns;
      this._cleanupFns = {};
      const fns = Object.values(cleanupFns);
      (0, import_log.logVerbose)(`Running ${fns.length} cleanup functions`);
      for (const fn of fns) {
        await fn(exitCode, err);
      }
      (0, import_log.logVerbose)("All cleanup functions ran");
      return flushAndExit(exitCode, err);
    });
  }
  registerCleanup(fn) {
    const handle = Math.random().toString(36).slice(2);
    this._cleanupFns[handle] = fn;
    return handle;
  }
  removeCleanup(handle) {
    const value = this._cleanupFns[handle];
    delete this._cleanupFns[handle];
    return value ?? null;
  }
  bigBrainAuth() {
    return this._bigBrainAuth;
  }
  _updateBigBrainAuth(auth) {
    (0, import_log.logVerbose)(`Updating big brain auth to ${auth?.kind ?? "null"}`);
    this._bigBrainAuth = auth;
  }
}
const oneoffContext = async (args) => {
  const ctx = new OneoffContextImpl();
  await (0, import_deploymentSelection.initializeBigBrainAuth)(ctx, {
    url: args.url,
    adminKey: args.adminKey,
    envFile: args.envFile
  });
  return ctx;
};
//# sourceMappingURL=context.js.map
