declare class RetryfyQueue {
    private interval;
    private intervalId?;
    private limit;
    private queueActive;
    private queueWaiting;
    init: () => void;
    reset: () => void;
    add: (fn: Function) => void;
    remove: (fn: Function) => void;
    schedule: () => Promise<Function>;
    tick: () => void;
}
declare const _default: RetryfyQueue;
export default _default;
