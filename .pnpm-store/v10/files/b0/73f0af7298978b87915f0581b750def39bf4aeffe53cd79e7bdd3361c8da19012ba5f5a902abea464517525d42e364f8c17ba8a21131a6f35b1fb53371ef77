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

import { Readable, ReadableOptions as ReadableOptions_ } from 'node:stream';
import { isIterable, isAsyncIterable } from '../../util/compat.js';

/** @ignore */
type ReadableOptions = ReadableOptions_;
/** @ignore */
type SourceIterator<T> = Generator<T, void, number | null>;
/** @ignore */
type AsyncSourceIterator<T> = AsyncGenerator<T, void, number | null>;

/** @ignore */
export function toNodeStream<T>(source: Iterable<T> | AsyncIterable<T>, options?: ReadableOptions): Readable {
    if (isAsyncIterable<T>(source)) { return new AsyncIterableReadable(source[Symbol.asyncIterator]() as AsyncSourceIterator<T>, options); }
    if (isIterable<T>(source)) { return new IterableReadable(source[Symbol.iterator]() as SourceIterator<T>, options); }
    /* istanbul ignore next */
    throw new Error(`toNodeStream() must be called with an Iterable or AsyncIterable`);
}

/** @ignore */
class IterableReadable<T extends Uint8Array | any> extends Readable {
    private _pulling: boolean;
    private _bytesMode: boolean;
    private _iterator: SourceIterator<T>;
    constructor(it: SourceIterator<T>, options?: ReadableOptions) {
        super(options);
        this._iterator = it;
        this._pulling = false;
        this._bytesMode = !options || !options.objectMode;
    }
    _read(size: number) {
        const it = this._iterator;
        if (it && !this._pulling && (this._pulling = true)) {
            this._pulling = this._pull(size, it);
        }
    }
    _destroy(e: Error | null, cb: (e: Error | null) => void) {
        const it = this._iterator;
        let fn: any;
        it && (fn = e != null && it.throw || it.return);
        fn?.call(it, e);
        cb && cb(null);
    }
    private _pull(size: number, it: SourceIterator<T>) {
        const bm = this._bytesMode;
        let r: IteratorResult<T> | null = null;
        while (this.readable && !(r = it.next(bm ? size : null)).done) {
            if (size != null) {
                size -= (bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1);
            }
            if (!this.push(r.value) || size <= 0) { break; }
        }
        if ((r?.done || !this.readable) && (this.push(null) || true)) {
            it.return && it.return();
        }
        return !this.readable;
    }
}

/** @ignore */
class AsyncIterableReadable<T extends Uint8Array | any> extends Readable {
    private _pulling: boolean;
    private _bytesMode: boolean;
    private _iterator: AsyncSourceIterator<T>;
    constructor(it: AsyncSourceIterator<T>, options?: ReadableOptions) {
        super(options);
        this._iterator = it;
        this._pulling = false;
        this._bytesMode = !options || !options.objectMode;
    }
    _read(size: number) {
        const it = this._iterator;
        if (it && !this._pulling && (this._pulling = true)) {
            (async () => this._pulling = await this._pull(size, it))();
        }
    }
    _destroy(e: Error | null, cb: (e: Error | null) => void) {
        const it = this._iterator;
        let fn: any;
        it && (fn = e != null && it.throw || it.return);
        fn?.call(it, e).then(() => cb && cb(null)) || (cb && cb(null));
    }
    private async _pull(size: number, it: AsyncSourceIterator<T>) {
        const bm = this._bytesMode;
        let r: IteratorResult<T> | null = null;
        while (this.readable && !(r = await it.next(bm ? size : null)).done) {
            if (size != null) {
                size -= (bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1);
            }
            if (!this.push(r.value) || size <= 0) { break; }
        }
        if ((r?.done || !this.readable) && (this.push(null) || true)) {
            it.return && it.return();
        }
        return !this.readable;
    }
}
