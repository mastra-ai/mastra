export class Mutex {
  currentlyRunning: Promise<void> | null = null;
  waiting: Array<() => Promise<void>> = [];

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const outerPromise = new Promise<T>((resolve, reject) => {
      const wrappedCallback: () => Promise<void> = () => {
        return fn()
          .then((v: T) => resolve(v))
          .catch((e: any) => reject(e));
      };
      this.enqueueCallbackForMutex(wrappedCallback);
    });
    return outerPromise;
  }

  private enqueueCallbackForMutex(callback: () => Promise<void>) {
    if (this.currentlyRunning === null) {
      this.currentlyRunning = callback().finally(() => {
        const nextCb = this.waiting.shift();
        if (nextCb === undefined) {
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
