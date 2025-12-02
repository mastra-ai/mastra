"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
export class Mutex {
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
