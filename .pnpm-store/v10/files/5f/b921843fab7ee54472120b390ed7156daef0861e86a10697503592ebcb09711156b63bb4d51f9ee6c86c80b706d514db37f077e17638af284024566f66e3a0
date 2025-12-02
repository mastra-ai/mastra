// Setting / Unsetting timeouts for every keystroke was a significant overhead
// Inspired from https://github.com/iostreamer-X/timeout-latch

export class TimeoutLatch {
  constructor(callback, timeoutMS) {
    this.timeLeftMS = void 0;
    this.timeoutMS = void 0;
    this.isCancelled = false;
    this.isTimeExhausted = false;
    this.callbacks = [];
    this.timeLeftMS = timeoutMS;
    this.timeoutMS = timeoutMS;
    this.callbacks.push(callback);
  }
  tick() {
    if (!this.isCancelled && !this.isTimeExhausted) {
      this.timeLeftMS--;
      if (this.timeLeftMS <= 0) {
        this.isTimeExhausted = true;
        var callbacks = this.callbacks.slice();
        this.callbacks.length = 0;
        callbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('TimeoutLatch callback error:', error);
          }
        });
      }
    }
  }
  cancel() {
    this.isCancelled = true;
    this.callbacks.length = 0;
  }
  reset() {
    this.timeLeftMS = this.timeoutMS;
    this.isCancelled = false;
    this.isTimeExhausted = false;
  }
  get isDone() {
    return this.isCancelled || this.isTimeExhausted;
  }
}
class Scheduler {
  constructor() {
    this.interval = null;
    this.latches = new Set();
  }
  add(latch) {
    this.latches.add(latch);
    this.start();
  }
  remove(latch) {
    this.latches.delete(latch);
    if (this.latches.size === 0) {
      this.stop();
    }
  }
  start() {
    if (this.interval === null) {
      this.interval = setInterval(() => {
        this.latches.forEach(latch => {
          latch.tick();
          if (latch.isDone) {
            this.remove(latch);
          }
        });
      }, 1);
    }
  }
  stop() {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
var globalScheduler = null;
export var getScheduler = () => {
  if (typeof window === 'undefined') {
    return new Scheduler();
  }
  if (!globalScheduler) {
    globalScheduler = new Scheduler();
  }
  return globalScheduler;
};