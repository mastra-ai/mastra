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
import { decodeUtf8 } from '../util/utf8.js';
import { ITERATOR_DONE, Readable, Writable, AsyncQueue } from './interfaces.js';
import { toUint8Array, joinUint8Arrays, ArrayBufferViewInput } from '../util/buffer.js';

import {
    isPromise, isFetchResponse,
    isIterable, isAsyncIterable,
    isReadableDOMStream, isReadableNodeStream
} from '../util/compat.js';

/** @ignore */
export type WritableSink<T> = Writable<T> | WritableStream<T> | NodeJS.WritableStream | null;
/** @ignore */
export type ReadableSource<T> = Readable<T> | PromiseLike<T> | AsyncIterable<T> | ReadableStream<T> | NodeJS.ReadableStream | null;

/** @ignore */
export class AsyncByteQueue<T extends ArrayBufferViewInput = Uint8Array> extends AsyncQueue<Uint8Array, T> {
    public write(value: ArrayBufferViewInput | Uint8Array) {
        if ((value = toUint8Array(value)).byteLength > 0) {
            return super.write(value as T);
        }
    }
    public toString(sync: true): string;
    public toString(sync?: false): Promise<string>;
    public toString(sync = false) {
        return sync
            ? decodeUtf8(this.toUint8Array(true))
            : this.toUint8Array(false).then(decodeUtf8);
    }
    public toUint8Array(sync: true): Uint8Array;
    public toUint8Array(sync?: false): Promise<Uint8Array>;
    public toUint8Array(sync = false) {
        return sync ? joinUint8Arrays(this._values as any[])[0] : (async () => {
            const buffers = [];
            let byteLength = 0;
            for await (const chunk of this) {
                buffers.push(chunk);
                byteLength += chunk.byteLength;
            }
            return joinUint8Arrays(buffers, byteLength)[0];
        })();
    }
}

/** @ignore */
export class ByteStream implements IterableIterator<Uint8Array> {
    declare private source: ByteStreamSource<Uint8Array>;
    constructor(source?: Iterable<ArrayBufferViewInput> | ArrayBufferViewInput) {
        if (source) {
            this.source = new ByteStreamSource(streamAdapters.fromIterable(source));
        }
    }
    [Symbol.iterator]() { return this; }
    public next(value?: any) { return this.source.next(value); }
    public throw(value?: any) { return this.source.throw(value); }
    public return(value?: any) { return this.source.return(value); }
    public peek(size?: number | null) { return this.source.peek(size); }
    public read(size?: number | null) { return this.source.read(size); }
}

/** @ignore */
export class AsyncByteStream implements Readable<Uint8Array>, AsyncIterableIterator<Uint8Array> {
    declare private source: AsyncByteStreamSource<Uint8Array>;
    constructor(source?: PromiseLike<ArrayBufferViewInput> | Response | ReadableStream<ArrayBufferViewInput> | NodeJS.ReadableStream | AsyncIterable<ArrayBufferViewInput> | Iterable<ArrayBufferViewInput>) {
        if (source instanceof AsyncByteStream) {
            this.source = (source as AsyncByteStream).source;
        } else if (source instanceof AsyncByteQueue) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        } else if (isReadableNodeStream(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromNodeStream(source));
        } else if (isReadableDOMStream<ArrayBufferViewInput>(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromDOMStream(source));
        } else if (isFetchResponse(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromDOMStream(source.body!));
        } else if (isIterable<ArrayBufferViewInput>(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromIterable(source));
        } else if (isPromise<ArrayBufferViewInput>(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        } else if (isAsyncIterable<ArrayBufferViewInput>(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        }
    }
    [Symbol.asyncIterator]() { return this; }
    public next(value?: any) { return this.source.next(value); }
    public throw(value?: any) { return this.source.throw(value); }
    public return(value?: any) { return this.source.return(value); }
    public get closed(): Promise<void> { return this.source.closed; }
    public cancel(reason?: any) { return this.source.cancel(reason); }
    public peek(size?: number | null) { return this.source.peek(size); }
    public read(size?: number | null) { return this.source.read(size); }
}

/** @ignore */
type ByteStreamSourceIterator<T> = Generator<T, null, { cmd: 'peek' | 'read'; size?: number | null }>;
/** @ignore */
type AsyncByteStreamSourceIterator<T> = AsyncGenerator<T, null, { cmd: 'peek' | 'read'; size?: number | null }>;

/** @ignore */
class ByteStreamSource<T> {
    constructor(protected source: ByteStreamSourceIterator<T>) { }
    public cancel(reason?: any) { this.return(reason); }
    public peek(size?: number | null): T | null { return this.next(size, 'peek').value; }
    public read(size?: number | null): T | null { return this.next(size, 'read').value; }
    public next(size?: number | null, cmd: 'peek' | 'read' = 'read') { return this.source.next({ cmd, size }); }
    public throw(value?: any) { return Object.create((this.source.throw && this.source.throw(value)) || ITERATOR_DONE); }
    public return(value?: any) { return Object.create((this.source.return && this.source.return(value)) || ITERATOR_DONE); }
}

/** @ignore */
class AsyncByteStreamSource<T> implements Readable<T> {

    private _closedPromise: Promise<void>;
    private _closedPromiseResolve?: (value?: any) => void;
    constructor(protected source: ByteStreamSourceIterator<T> | AsyncByteStreamSourceIterator<T>) {
        this._closedPromise = new Promise((r) => this._closedPromiseResolve = r);
    }
    public async cancel(reason?: any) { await this.return(reason); }
    public get closed(): Promise<void> { return this._closedPromise; }
    public async read(size?: number | null): Promise<T | null> { return (await this.next(size, 'read')).value; }
    public async peek(size?: number | null): Promise<T | null> { return (await this.next(size, 'peek')).value; }
    public async next(size?: number | null, cmd: 'peek' | 'read' = 'read') { return (await this.source.next({ cmd, size })); }
    public async throw(value?: any) {
        const result = (this.source.throw && await this.source.throw(value)) || ITERATOR_DONE;
        this._closedPromiseResolve && this._closedPromiseResolve();
        this._closedPromiseResolve = undefined;
        return Object.create(result);
    }
    public async return(value?: any) {
        const result = (this.source.return && await this.source.return(value)) || ITERATOR_DONE;
        this._closedPromiseResolve && this._closedPromiseResolve();
        this._closedPromiseResolve = undefined;
        return Object.create(result);
    }
}
