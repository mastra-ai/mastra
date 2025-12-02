import {
  createWorkerTimers
} from "./chunk-ZHPWRK4R.mjs";

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

export {
  Poller
};
//# sourceMappingURL=chunk-JY46X3OC.mjs.map