"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import * as Sentry from "@sentry/node";
import { nodeFs } from "./fs.js";
import { initializeBigBrainAuth } from "../cli/lib/deploymentSelection.js";
import { logFailure, logVerbose } from "./log.js";
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
    __publicField(this, "fs", nodeFs);
    __publicField(this, "deprecationMessagePrinted", false);
    __publicField(this, "spinner");
    __publicField(this, "_bigBrainAuth", null);
    __publicField(this, "crash", async (args) => {
      if (args.printedMessage !== null) {
        logFailure(args.printedMessage);
      }
      return await this.flushAndExit(args.exitCode, args.errForSentry);
    });
    __publicField(this, "flushAndExit", async (exitCode, err) => {
      logVerbose("Flushing and exiting, error:", err);
      if (err) {
        logVerbose(err.stack);
      }
      const cleanupFns = this._cleanupFns;
      this._cleanupFns = {};
      const fns = Object.values(cleanupFns);
      logVerbose(`Running ${fns.length} cleanup functions`);
      for (const fn of fns) {
        await fn(exitCode, err);
      }
      logVerbose("All cleanup functions ran");
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
    logVerbose(`Updating big brain auth to ${auth?.kind ?? "null"}`);
    this._bigBrainAuth = auth;
  }
}
export const oneoffContext = async (args) => {
  const ctx = new OneoffContextImpl();
  await initializeBigBrainAuth(ctx, {
    url: args.url,
    adminKey: args.adminKey,
    envFile: args.envFile
  });
  return ctx;
};
//# sourceMappingURL=context.js.map
