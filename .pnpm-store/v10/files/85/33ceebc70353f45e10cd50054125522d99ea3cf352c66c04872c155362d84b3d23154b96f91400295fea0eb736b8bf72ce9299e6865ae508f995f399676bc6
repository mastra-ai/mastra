export declare class TimeoutLatch {
    private timeLeftMS;
    private timeoutMS;
    private isCancelled;
    private isTimeExhausted;
    private callbacks;
    constructor(callback: Function, timeoutMS: number);
    tick(): void;
    cancel(): void;
    reset(): void;
    get isDone(): boolean;
}
declare class Scheduler {
    private interval;
    private latches;
    add(latch: TimeoutLatch): void;
    remove(latch: TimeoutLatch): void;
    private start;
    private stop;
}
export declare const getScheduler: () => Scheduler;
export {};
