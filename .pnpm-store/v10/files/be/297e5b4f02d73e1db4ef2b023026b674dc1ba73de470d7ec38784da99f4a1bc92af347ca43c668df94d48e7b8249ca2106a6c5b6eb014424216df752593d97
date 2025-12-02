/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { ArrowJSONLike } from '../io/interfaces.js';
import type { ByteBuffer } from 'flatbuffers';
import type { ReadStream } from 'node:fs';
import type { FileHandle as FileHandle_ } from 'node:fs/promises';
/** @ignore */
export interface Subscription {
    unsubscribe: () => void;
}
/** @ignore */
export interface Observer<T> {
    closed?: boolean;
    next: (value: T) => void;
    error: (err: any) => void;
    complete: () => void;
}
/** @ignore */
export interface Observable<T> {
    subscribe: (observer: Observer<T>) => Subscription;
}
/** @ignore */
export declare const isObject: (x: any) => x is Object;
/** @ignore */
export declare const isPromise: <T = any>(x: any) => x is PromiseLike<T>;
/** @ignore */
export declare const isObservable: <T = any>(x: any) => x is Observable<T>;
/** @ignore */
export declare const isIterable: <T = any>(x: any) => x is Iterable<T>;
/** @ignore */
export declare const isAsyncIterable: <T = any>(x: any) => x is AsyncIterable<T>;
/** @ignore */
export declare const isArrowJSON: (x: any) => x is ArrowJSONLike;
/** @ignore */
export declare const isArrayLike: <T = any>(x: any) => x is ArrayLike<T>;
/** @ignore */
export declare const isIteratorResult: <T = any>(x: any) => x is IteratorResult<T, any>;
/** @ignore */
export declare const isUnderlyingSink: <T = any>(x: any) => x is UnderlyingSink<T>;
/** @ignore */
export declare const isFileHandle: (x: any) => x is FileHandle_;
/** @ignore */
export declare const isFSReadStream: (x: any) => x is ReadStream;
/** @ignore */
export declare const isFetchResponse: (x: any) => x is Response;
/** @ignore */
export declare const isWritableDOMStream: <T = any>(x: any) => x is WritableStream<T>;
/** @ignore */
export declare const isReadableDOMStream: <T = any>(x: any) => x is ReadableStream<T>;
/** @ignore */
export declare const isWritableNodeStream: (x: any) => x is NodeJS.WritableStream;
/** @ignore */
export declare const isReadableNodeStream: (x: any) => x is NodeJS.ReadableStream;
/** @ignore */
export declare const isFlatbuffersByteBuffer: (x: any) => x is ByteBuffer;
