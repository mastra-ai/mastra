import { Observations, RecordingFs, WatchEvent } from "../../bundler/fs.js";
import { BigBrainAuth, Context, ErrorType } from "../../bundler/context.js";
import { Ora } from "ora";
export declare class Watcher {
    private watch;
    private readyCb;
    private bufferedEvents;
    private waiters;
    constructor(observations: Observations);
    update(observations: Observations): void;
    isWatched(watchedDirs: Set<string>, observedPath: string): boolean;
    ready(): Promise<void>;
    waitForEvent(): Promise<void>;
    drainEvents(): WatchEvent[];
    close(): Promise<void>;
}
export declare class Crash extends Error {
    errorType?: ErrorType;
    constructor(errorType?: ErrorType, err?: any);
}
export declare class WatchContext implements Context {
    private _cleanupFns;
    fs: RecordingFs;
    deprecationMessagePrinted: boolean;
    spinner: Ora | undefined;
    private _bigBrainAuth;
    constructor(traceEvents: boolean, bigBrainAuth: BigBrainAuth | null);
    crash(args: {
        exitCode: number;
        errorType?: ErrorType;
        errForSentry?: any;
        printedMessage: string | null;
    }): Promise<never>;
    registerCleanup(fn: (exitCode: number, err?: any) => Promise<void>): string;
    removeCleanup(handle: string): (exitCode: number, err?: any) => Promise<void>;
    bigBrainAuth(): BigBrainAuth | null;
    _updateBigBrainAuth(auth: BigBrainAuth | null): void;
}
//# sourceMappingURL=watch.d.ts.map