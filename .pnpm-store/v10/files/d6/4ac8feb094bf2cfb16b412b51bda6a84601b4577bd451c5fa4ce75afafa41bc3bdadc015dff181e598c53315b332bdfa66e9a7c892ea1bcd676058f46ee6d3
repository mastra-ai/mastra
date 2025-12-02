/**
 * A WaitGroup waits for a collection of actions to finish.
 * The main goroutine calls `add` to set the number of actions to wait for.
 * Then each of the actions runs and calls `done` when finished.
 * At the same time, `wait` can be used to return a promise that resolves when all actions have finished.
 *
 * The class doesn't implement the race-condition requirements that the Golang package has due to the
 * way Node functions, meaning `add`, `done` and `wait` can be called at any time, in any order.
 */
export declare class WaitGroup {
    private current;
    private queued;
    private queue;
    private resolveQueue;
    /**
   * Adds a delta, which may be negative, to the WaitGroup counter.
   * If the counter becomes zero, all promises returned from `wait` are resolved.
   * If the counter goes negative, an error is thrown.
   */
    add(delta?: number): void;
    /**
   * Decrements the WaitGroup counter by one.
   */
    done(): void;
    /**
   * Returns a promise that resolves when the WaitGroup counter is zero.
   * If the counter is zero when the method is called, it's resolved immediately.
   */
    wait(): Promise<void>;
}
