"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import chokidar from "chokidar";
import path from "path";
import { RecordingFs } from "../../bundler/fs.js";
import { logFailure } from "../../bundler/log.js";
import * as Sentry from "@sentry/node";
export class Watcher {
  constructor(observations) {
    __publicField(this, "watch");
    __publicField(this, "readyCb");
    __publicField(this, "bufferedEvents");
    __publicField(this, "waiters");
    this.bufferedEvents = [];
    this.waiters = [];
    const watch = chokidar.watch(observations.paths(), { persistent: true });
    watch.on("all", (eventName, eventPath) => {
      const absPath = path.resolve(eventPath);
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
      const parsed = path.parse(curPath);
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
export class Crash extends Error {
  constructor(errorType, err) {
    super(err?.message);
    __publicField(this, "errorType");
    if (errorType) {
      this.errorType = errorType;
    }
  }
}
export class WatchContext {
  constructor(traceEvents, bigBrainAuth) {
    __publicField(this, "_cleanupFns", {});
    __publicField(this, "fs");
    __publicField(this, "deprecationMessagePrinted");
    __publicField(this, "spinner");
    __publicField(this, "_bigBrainAuth");
    this.fs = new RecordingFs(traceEvents);
    this.deprecationMessagePrinted = false;
    this._bigBrainAuth = bigBrainAuth;
  }
  async crash(args) {
    if (args.errForSentry) {
      Sentry.captureException(args.errForSentry);
    }
    if (args.printedMessage !== null) {
      logFailure(args.printedMessage);
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
