type WorkerTimerId = number;
type WorkerTimeoutCallback = () => void;
type WorkerSetTimeout = (cb: WorkerTimeoutCallback, ms: number) => WorkerTimerId;
type WorkerClearTimeout = (id: WorkerTimerId) => void;

declare const createWorkerTimers: () => {
    setTimeout: WorkerSetTimeout;
    setInterval: WorkerSetTimeout;
    clearTimeout: WorkerClearTimeout;
    clearInterval: WorkerClearTimeout;
    cleanup: (..._args: any[]) => void;
};

export { createWorkerTimers };
