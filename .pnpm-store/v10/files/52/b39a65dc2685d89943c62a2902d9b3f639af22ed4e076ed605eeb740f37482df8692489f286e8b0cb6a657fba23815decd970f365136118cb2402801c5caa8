/// <reference types="node" />
import { EventEmitter } from "events";
export declare const signalEvent = "internal-abort";
export interface AbortSignal extends EventEmitter {
    readonly aborted: boolean;
    onabort: () => void;
}
export declare class AbortController {
    readonly signal: AbortSignal;
    abort: () => void;
}
