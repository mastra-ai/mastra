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
var watch_exports = {};
__export(watch_exports, {
  Crash: () => Crash,
  WatchContext: () => WatchContext,
  Watcher: () => Watcher
});
module.exports = __toCommonJS(watch_exports);
var import_chokidar = __toESM(require("chokidar"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = require("../../bundler/fs.js");
var import_log = require("../../bundler/log.js");
var Sentry = __toESM(require("@sentry/node"), 1);
class Watcher {
  constructor(observations) {
    __publicField(this, "watch");
    __publicField(this, "readyCb");
    __publicField(this, "bufferedEvents");
    __publicField(this, "waiters");
    this.bufferedEvents = [];
    this.waiters = [];
    const watch = import_chokidar.default.watch(observations.paths(), { persistent: true });
    watch.on("all", (eventName, eventPath) => {
      const absPath = import_path.default.resolve(eventPath);
      this.bufferedEvents.push({ name: eventName, absPath });
      for (const waiter of drain(this.waiters)) {
        waiter();
      }
    });
    this.readyCb = new Promise((resolve) => {
      watch.on("ready", () => resolve());
    });
    this.watch = watch;
  }
  update(observations) {
    const watchedDirs = new Set(Object.keys(this.watch.getWatched()));
    for (const newPath of observations.paths()) {
      if (!this.isWatched(watchedDirs, newPath)) {
        this.watch.add(newPath);
      }
    }
  }
  isWatched(watchedDirs, observedPath) {
    let curPath = observedPath;
    while (true) {
      const parsed = import_path.default.parse(curPath);
      if (parsed.dir === curPath) {
        break;
      }
      if (watchedDirs.has(curPath)) {
        return true;
      }
      curPath = parsed.dir;
    }
    return false;
  }
  async ready() {
    await this.readyCb;
  }
  async waitForEvent() {
    while (this.bufferedEvents.length === 0) {
      const newEvent = new Promise((resolve) => {
        this.waiters.push(resolve);
      });
      await newEvent;
    }
  }
  drainEvents() {
    return drain(this.bufferedEvents);
  }
  async close() {
    await this.watch.close();
  }
}
function drain(l) {
  return l.splice(0, l.length);
}
class Crash extends Error {
  constructor(errorType, err) {
    super(err?.message);
    __publicField(this, "errorType");
    if (errorType) {
      this.errorType = errorType;
    }
  }
}
class WatchContext {
  constructor(traceEvents, bigBrainAuth) {
    __publicField(this, "_cleanupFns", {});
    __publicField(this, "fs");
    __publicField(this, "deprecationMessagePrinted");
    __publicField(this, "spinner");
    __publicField(this, "_bigBrainAuth");
    this.fs = new import_fs.RecordingFs(traceEvents);
    this.deprecationMessagePrinted = false;
    this._bigBrainAuth = bigBrainAuth;
  }
  async crash(args) {
    if (args.errForSentry) {
      Sentry.captureException(args.errForSentry);
    }
    if (args.printedMessage !== null) {
      (0, import_log.logFailure)(args.printedMessage);
    }
    for (const fn of Object.values(this._cleanupFns)) {
      await fn(args.exitCode, args.errForSentry);
    }
    throw new Crash(args.errorType, args.errForSentry);
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
    this._bigBrainAuth = auth;
  }
}
//# sourceMappingURL=watch.js.map
