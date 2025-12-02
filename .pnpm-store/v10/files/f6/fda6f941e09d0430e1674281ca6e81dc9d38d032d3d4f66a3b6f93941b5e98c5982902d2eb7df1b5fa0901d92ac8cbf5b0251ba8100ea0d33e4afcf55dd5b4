/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
export type { FileHandle } from 'node:fs/promises';
import type { ReadableOptions, Readable as StreamReadable } from 'node:stream';
/** @ignore */
export declare const ITERATOR_DONE: any;
/** @ignore */
export type ArrowJSONLike = {
    schema: any;
    batches?: any[];
    dictionaries?: any[];
};
/** @ignore */
export type ReadableDOMStreamOptions = {
    type: 'bytes' | undefined;
    autoAllocateChunkSize?: number;
    highWaterMark?: number;
};
/** @ignore */
export declare class ArrowJSON {
    private _json;
    constructor(_json: ArrowJSONLike);
    get schema(): any;
    get batches(): any[];
    get dictionaries(): any[];
}
/** @ignore */
export interface Readable<T> {
    readonly closed: Promise<void>;
    cancel(reason?: any): Promise<void>;
    read(size?: number | null): Promise<T | null>;
    peek(size?: number | null): Promise<T | null>;
    throw(value?: any): Promise<IteratorResult<any>>;
    return(value?: any): Promise<IteratorResult<any>>;
    next(size?: number | null): Promise<IteratorResult<T>>;
}
/** @ignore */
export interface Writable<T> {
    readonly closed: Promise<void>;
    close(): void;
    write(chunk: T): void;
    abort(reason?: any): void;
}
/** @ignore */
export interface ReadableWritable<TReadable, TWritable> extends Readable<TReadable>, Writable<TWritable> {
    [Symbol.asyncIterator](): AsyncIterableIterator<TReadable>;
    toDOMStream(options?: ReadableDOMStreamOptions): ReadableStream<TReadable>;
    toNodeStream(options?: ReadableOptions): StreamReadable;
}
/** @ignore */
export declare abstract class ReadableInterop<T> {
    abstract toDOMStream(options?: ReadableDOMStreamOptions): ReadableStream<T>;
    abstract toNodeStream(options?: ReadableOptions): StreamReadable;
    tee(): [ReadableStream<T>, ReadableStream<T>];
    pipe<R extends NodeJS.WritableStream>(writable: R, options?: {
        end?: boolean;
    }): R;
    pipeTo(writable: WritableStream<T>, options?: StreamPipeOptions): Promise<void>;
    pipeThrough<R extends ReadableStream<any>>(duplex: {
        writable: WritableStream<T>;
        readable: R;
    }, options?: StreamPipeOptions): ReadableStream<any>;
    protected _DOMStream?: ReadableStream<T>;
    private _getDOMStream;
    protected _nodeStream?: StreamReadable;
    private _getNodeStream;
}
/** @ignore */
type Resolution<T> = {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
};
/** @ignore */
export declare class AsyncQueue<TReadable = Uint8Array, TWritable = TReadable> extends ReadableInterop<TReadable> implements AsyncIterableIterator<TReadable>, ReadableWritable<TReadable, TWritable> {
    protected _values: TWritable[];
    protected _error?: {
        error: any;
    };
    protected _closedPromise: Promise<void>;
    protected _closedPromiseResolve?: (value?: any) => void;
    protected resolvers: Resolution<IteratorResult<TReadable>>[];
    constructor();
    get closed(): Promise<void>;
    cancel(reason?: any): Promise<void>;
    write(value: TWritable): void;
    abort(value?: any): void;
    close(): void;
    [Symbol.asyncIterator](): this;
    toDOMStream(options?: ReadableDOMStreamOptions): ReadableStream<TReadable>;
    toNodeStream(options?: ReadableOptions): StreamReadable;
    throw(_?: any): Promise<any>;
    return(_?: any): Promise<any>;
    read(size?: number | null): Promise<TReadable | null>;
    peek(size?: number | null): Promise<TReadable | null>;
    next(..._args: any[]): Promise<IteratorResult<TReadable>>;
    protected _ensureOpen(): boolean;
}
