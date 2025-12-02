// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import streamAdapters from './adapters.js';

export type { FileHandle } from 'node:fs/promises';
import type { ReadableOptions, Readable as StreamReadable } from 'node:stream';

/** @ignore */
export const ITERATOR_DONE: any = Object.freeze({ done: true, value: void (0) });

/** @ignore */
export type ArrowJSONLike = { schema: any; batches?: any[]; dictionaries?: any[] };
/** @ignore */
export type ReadableDOMStreamOptions = { type: 'bytes' | undefined; autoAllocateChunkSize?: number; highWaterMark?: number };

/** @ignore */
export class ArrowJSON {
    constructor(private _json: ArrowJSONLike) { }
    public get schema(): any { return this._json['schema']; }
    public get batches(): any[] { return (this._json['batches'] || []) as any[]; }
    public get dictionaries(): any[] { return (this._json['dictionaries'] || []) as any[]; }
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
export abstract class ReadableInterop<T> {

    public abstract toDOMStream(options?: ReadableDOMStreamOptions): ReadableStream<T>;
    public abstract toNodeStream(options?: ReadableOptions): StreamReadable;

    public tee(): [ReadableStream<T>, ReadableStream<T>] {
        return this._getDOMStream().tee();
    }
    public pipe<R extends NodeJS.WritableStream>(writable: R, options?: { end?: boolean }) {
        return this._getNodeStream().pipe(writable, options);
    }
    public pipeTo(writable: WritableStream<T>, options?: StreamPipeOptions) { return this._getDOMStream().pipeTo(writable, options); }
    public pipeThrough<R extends ReadableStream<any>>(duplex: { writable: WritableStream<T>; readable: R }, options?: StreamPipeOptions) {
        return this._getDOMStream().pipeThrough(duplex, options);
    }

    protected _DOMStream?: ReadableStream<T>;
    private _getDOMStream() {
        return this._DOMStream || (this._DOMStream = this.toDOMStream());
    }

    protected _nodeStream?: StreamReadable;
    private _getNodeStream() {
        return this._nodeStream || (this._nodeStream = this.toNodeStream());
    }
}

/** @ignore */
type Resolution<T> = { resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: any) => void };

/** @ignore */
export class AsyncQueue<TReadable = Uint8Array, TWritable = TReadable> extends ReadableInterop<TReadable>
    implements AsyncIterableIterator<TReadable>, ReadableWritable<TReadable, TWritable> {

    protected _values: TWritable[] = [];
    protected _error?: { error: any };
    protected _closedPromise: Promise<void>;
    protected _closedPromiseResolve?: (value?: any) => void;
    protected resolvers: Resolution<IteratorResult<TReadable>>[] = [];

    constructor() {
        super();
        this._closedPromise = new Promise((r) => this._closedPromiseResolve = r);
    }

    public get closed(): Promise<void> { return this._closedPromise; }
    public async cancel(reason?: any) { await this.return(reason); }
    public write(value: TWritable) {
        if (this._ensureOpen()) {
            this.resolvers.length <= 0
                ? (this._values.push(value))
                : (this.resolvers.shift()!.resolve({ done: false, value } as any));
        }
    }
    public abort(value?: any) {
        if (this._closedPromiseResolve) {
            this.resolvers.length <= 0
                ? (this._error = { error: value })
                : (this.resolvers.shift()!.reject({ done: true, value }));
        }
    }
    public close() {
        if (this._closedPromiseResolve) {
            const { resolvers } = this;
            while (resolvers.length > 0) {
                resolvers.shift()!.resolve(ITERATOR_DONE);
            }
            this._closedPromiseResolve();
            this._closedPromiseResolve = undefined;
        }
    }

    public [Symbol.asyncIterator]() { return this; }
    public toDOMStream(options?: ReadableDOMStreamOptions) {
        return streamAdapters.toDOMStream(
            (this._closedPromiseResolve || this._error)
                ? (this as AsyncIterable<TReadable>)
                : (this._values as any) as Iterable<TReadable>,
            options);
    }
    public toNodeStream(options?: ReadableOptions) {
        return streamAdapters.toNodeStream(
            (this._closedPromiseResolve || this._error)
                ? (this as AsyncIterable<TReadable>)
                : (this._values as any) as Iterable<TReadable>,
            options);
    }
    public async throw(_?: any) { await this.abort(_); return ITERATOR_DONE; }
    public async return(_?: any) { await this.close(); return ITERATOR_DONE; }

    public async read(size?: number | null): Promise<TReadable | null> { return (await this.next(size, 'read')).value; }
    public async peek(size?: number | null): Promise<TReadable | null> { return (await this.next(size, 'peek')).value; }
    public next(..._args: any[]): Promise<IteratorResult<TReadable>> {
        if (this._values.length > 0) {
            return Promise.resolve({ done: false, value: this._values.shift()! } as any);
        } else if (this._error) {
            return Promise.reject({ done: true, value: this._error.error });
        } else if (!this._closedPromiseResolve) {
            return Promise.resolve(ITERATOR_DONE);
        } else {
            return new Promise<IteratorResult<TReadable>>((resolve, reject) => {
                this.resolvers.push({ resolve, reject });
            });
        }
    }

    protected _ensureOpen() {
        if (this._closedPromiseResolve) {
            return true;
        }
        throw new Error(`AsyncQueue is closed`);
    }
}
