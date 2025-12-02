// Setting / Unsetting timeouts for every keystroke was a significant overhead
// Inspired from https://github.com/iostreamer-X/timeout-latch

export class TimeoutLatch {
  private timeLeftMS: number;
  private timeoutMS: number;
  private isCancelled = false;
  private isTimeExhausted = false;
  private callbacks: Function[] = [];

  constructor(callback: Function, timeoutMS: number) {
    this.timeLeftMS = timeoutMS;
    this.timeoutMS = timeoutMS;
    this.callbacks.push(callback);
  }

  tick(): void {
    if (!this.isCancelled && !this.isTimeExhausted) {
      this.timeLeftMS--;
      if (this.timeLeftMS <= 0) {
        this.isTimeExhausted = true;
        const callbacks = this.callbacks.slice();
        this.callbacks.length = 0;
        callbacks.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.error('TimeoutLatch callback error:', error);
          }
        });
      }
    }
  }

  cancel(): void {
    this.isCancelled = true;
    this.callbacks.length = 0;
  }

  reset(): void {
    this.timeLeftMS = this.timeoutMS;
    this.isCancelled = false;
    this.isTimeExhausted = false;
  }

  get isDone(): boolean {
    return this.isCancelled || this.isTimeExhausted;
  }
}

class Scheduler {
  private interval: NodeJS.Timeout | null = null;
  private latches = new Set<TimeoutLatch>();

  add(latch: TimeoutLatch): void {
    this.latches.add(latch);
    this.start();
  }

  remove(latch: TimeoutLatch): void {
    this.latches.delete(latch);
    if (this.latches.size === 0) {
      this.stop();
    }
  }

  private start(): void {
    if (this.interval === null) {
      this.interval = setInterval(() => {
        this.latches.forEach((latch) => {
          latch.tick();
          if (latch.isDone) {
            this.remove(latch);
          }
        });
      }, 1);
    }
  }

  private stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

let globalScheduler: Scheduler | null = null;

export const getScheduler = (): Scheduler => {
  if (typeof window === 'undefined') {
    return new Scheduler();
  }
  if (!globalScheduler) {
    globalScheduler = new Scheduler();
  }
  return globalScheduler;
};
