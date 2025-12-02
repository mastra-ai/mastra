"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var mutex_exports = {};
__export(mutex_exports, {
  Mutex: () => Mutex
});
module.exports = __toCommonJS(mutex_exports);
class Mutex {
  constructor() {
    __publicField(this, "currentlyRunning", null);
    __publicField(this, "waiting", []);
  }
  async runExclusive(fn) {
    const outerPromise = new Promise((resolve, reject) => {
      const wrappedCallback = () => {
        return fn().then((v) => resolve(v)).catch((e) => reject(e));
      };
      this.enqueueCallbackForMutex(wrappedCallback);
    });
    return outerPromise;
  }
  enqueueCallbackForMutex(callback) {
    if (this.currentlyRunning === null) {
      this.currentlyRunning = callback().finally(() => {
        const nextCb = this.waiting.shift();
        if (nextCb === void 0) {
          this.currentlyRunning = null;
        } else {
          this.enqueueCallbackForMutex(nextCb);
        }
      });
      this.waiting.length = 0;
    } else {
      this.waiting.push(callback);
    }
  }
}
//# sourceMappingURL=mutex.js.map
