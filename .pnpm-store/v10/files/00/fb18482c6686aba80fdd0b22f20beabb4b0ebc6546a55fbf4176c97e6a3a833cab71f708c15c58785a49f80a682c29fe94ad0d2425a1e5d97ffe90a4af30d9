type PollerStop = () => void;
type PollerCallback = (stop: PollerStop) => Promise<unknown>;
type PollerRun = (cb: PollerCallback) => Promise<void>;
type PollerOptions = {
    delayInMs: number;
};
type Poller = {
    run: PollerRun;
    stop: PollerStop;
};
declare function Poller({ delayInMs }?: PollerOptions): Poller;

export { Poller, type PollerCallback, type PollerRun, type PollerStop };
