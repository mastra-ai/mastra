/** Keep writes to one record ordered without blocking unrelated records. */
export class KeyedQueue {
  private readonly pending = new Map<string, Promise<void>>();

  enqueue(key: string, write: () => Promise<void>): Promise<void> {
    const previous = this.pending.get(key);
    // Failure of an earlier write must not discard a later correction.
    const current = (previous ?? Promise.resolve()).catch(() => {}).then(write);
    this.pending.set(key, current);
    const cleanup = () => {
      if (this.pending.get(key) === current) this.pending.delete(key);
    };
    void current.then(cleanup, cleanup);
    return current;
  }
}
