import { InferenceSession as InferenceSessionInterface } from './inference-session.js';
type SessionOptions = InferenceSessionInterface.SessionOptions;
type RunOptions = InferenceSessionInterface.RunOptions;
type FeedsType = InferenceSessionInterface.FeedsType;
type FetchesType = InferenceSessionInterface.FetchesType;
type ReturnType = InferenceSessionInterface.ReturnType;
export declare class InferenceSession implements InferenceSessionInterface {
    private constructor();
    run(feeds: FeedsType, options?: RunOptions): Promise<ReturnType>;
    run(feeds: FeedsType, fetches: FetchesType, options?: RunOptions): Promise<ReturnType>;
    release(): Promise<void>;
    static create(path: string, options?: SessionOptions): Promise<InferenceSessionInterface>;
    static create(buffer: ArrayBufferLike, options?: SessionOptions): Promise<InferenceSessionInterface>;
    static create(buffer: ArrayBufferLike, byteOffset: number, byteLength?: number, options?: SessionOptions): Promise<InferenceSessionInterface>;
    static create(buffer: Uint8Array, options?: SessionOptions): Promise<InferenceSessionInterface>;
    startProfiling(): void;
    endProfiling(): void;
    get inputNames(): readonly string[];
    get outputNames(): readonly string[];
    private handler;
}
export {};
//# sourceMappingURL=inference-session-impl.d.ts.map