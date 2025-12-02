export declare class Mutex {
    currentlyRunning: Promise<void> | null;
    waiting: Array<() => Promise<void>>;
    runExclusive<T>(fn: () => Promise<T>): Promise<T>;
    private enqueueCallbackForMutex;
}
//# sourceMappingURL=mutex.d.ts.map