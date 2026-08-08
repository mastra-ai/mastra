/**
 * Delayed promise. It is only constructed once the value is accessed.
 * This is useful to avoid unhandled promise rejections when the promise is created
 * but not accessed.
 */
export class DelayedPromise<T> {
  public status: { type: 'pending' } | { type: 'resolved'; value: T } | { type: 'rejected'; error: unknown } = {
    type: 'pending',
  };
  private _promise: Promise<T> | undefined;
  private _resolve: undefined | ((value: T) => void) = undefined;
  private _reject: undefined | ((error: unknown) => void) = undefined;

  get promise(): Promise<T> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = new Promise<T>((resolve, reject) => {
      if (this.status.type === 'resolved') {
        resolve(this.status.value);
      } else if (this.status.type === 'rejected') {
        reject(this.status.error);
      }

      this._resolve = resolve;
      this._reject = reject;
    });

    return this._promise;
  }

  resolve(value: T): void {
    this.status = { type: 'resolved', value };

    if (this._promise) {
      this._resolve?.(value);
    }
  }

  reject(error: unknown): void {
    this.status = { type: 'rejected', error };

    if (this._promise) {
      this._reject?.(error);
    }
  }

  /**
   * Return an already-settled promise to `pending` so a superseding value can
   * settle it instead. Used when the attempt that produced the current value is
   * rejected and retried, making that value stale.
   *
   * Only safe while the promise has never been materialized: once `promise` has
   * been accessed, the value may already have been observed and JS promises
   * cannot be un-settled. Returns `false` in that case so callers can tell that
   * the stale value is still reachable through the promise.
   */
  reset(): boolean {
    if (this._promise) {
      return false;
    }

    this.status = { type: 'pending' };
    return true;
  }
}
