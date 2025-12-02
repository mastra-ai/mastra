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

// src/poller.ts
var poller_exports = {};
__export(poller_exports, {
  Poller: () => Poller
});
module.exports = __toCommonJS(poller_exports);

// src/utils/noop.ts
var noop = (..._args) => {
};

// src/workerTimers/workerTimers.worker.ts
var workerTimers_worker_default = 'const respond=r=>{self.postMessage(r)},workerToTabIds={};self.addEventListener("message",r=>{const e=r.data;switch(e.type){case"setTimeout":workerToTabIds[e.id]=setTimeout(()=>{respond({id:e.id}),delete workerToTabIds[e.id]},e.ms);break;case"clearTimeout":workerToTabIds[e.id]&&(clearTimeout(workerToTabIds[e.id]),delete workerToTabIds[e.id]);break;case"setInterval":workerToTabIds[e.id]=setInterval(()=>{respond({id:e.id})},e.ms);break;case"clearInterval":workerToTabIds[e.id]&&(clearInterval(workerToTabIds[e.id]),delete workerToTabIds[e.id]);break}});\n';

// src/workerTimers/createWorkerTimers.ts
var createWebWorker = (source, opts = {}) => {
  if (typeof Worker === "undefined") {
    return null;
  }
  try {
    const blob = new Blob([source], { type: "application/javascript; charset=utf-8" });
    const workerScript = globalThis.URL.createObjectURL(blob);
    return new Worker(workerScript, opts);
  } catch {
    console.warn("Clerk: Cannot create worker from blob. Consider adding worker-src blob:; to your CSP");
    return null;
  }
};
var fallbackTimers = () => {
  const setTimeout = globalThis.setTimeout.bind(globalThis);
  const setInterval = globalThis.setInterval.bind(globalThis);
  const clearTimeout = globalThis.clearTimeout.bind(globalThis);
  const clearInterval = globalThis.clearInterval.bind(globalThis);
  return { setTimeout, setInterval, clearTimeout, clearInterval, cleanup: noop };
};
var createWorkerTimers = () => {
  let id = 0;
  const generateId = () => id++;
  const callbacks = /* @__PURE__ */ new Map();
  const post = (w, p) => w?.postMessage(p);
  const handleMessage = (e) => {
    callbacks.get(e.data.id)?.();
  };
  let worker = createWebWorker(workerTimers_worker_default, { name: "clerk-timers" });
  worker?.addEventListener("message", handleMessage);
  if (!worker) {
    return fallbackTimers();
  }
  const init = () => {
    if (!worker) {
      worker = createWebWorker(workerTimers_worker_default, { name: "clerk-timers" });
      worker?.addEventListener("message", handleMessage);
    }
  };
  const cleanup = () => {
    if (worker) {
      worker.terminate();
      worker = null;
      callbacks.clear();
    }
  };
  const setTimeout = (cb, ms) => {
    init();
    const id2 = generateId();
    callbacks.set(id2, () => {
      cb();
      callbacks.delete(id2);
    });
    post(worker, { type: "setTimeout", id: id2, ms });
    return id2;
  };
  const setInterval = (cb, ms) => {
    init();
    const id2 = generateId();
    callbacks.set(id2, cb);
    post(worker, { type: "setInterval", id: id2, ms });
    return id2;
  };
  const clearTimeout = (id2) => {
    init();
    callbacks.delete(id2);
    post(worker, { type: "clearTimeout", id: id2 });
  };
  const clearInterval = (id2) => {
    init();
    callbacks.delete(id2);
    post(worker, { type: "clearInterval", id: id2 });
  };
  return { setTimeout, setInterval, clearTimeout, clearInterval, cleanup };
};

// src/poller.ts
function Poller({ delayInMs } = { delayInMs: 1e3 }) {
  const workerTimers = createWorkerTimers();
  let timerId;
  let stopped = false;
  const stop = () => {
    if (timerId) {
      workerTimers.clearTimeout(timerId);
      workerTimers.cleanup();
    }
    stopped = true;
  };
  const run = async (cb) => {
    stopped = false;
    await cb(stop);
    if (stopped) {
      return;
    }
    timerId = workerTimers.setTimeout(() => {
      void run(cb);
    }, delayInMs);
  };
  return { run, stop };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Poller
});
//# sourceMappingURL=poller.js.map