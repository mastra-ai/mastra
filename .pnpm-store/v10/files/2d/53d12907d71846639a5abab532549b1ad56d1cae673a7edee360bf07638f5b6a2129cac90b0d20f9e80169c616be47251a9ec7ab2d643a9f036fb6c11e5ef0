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
import { __asyncValues, __awaiter } from "tslib";
import streamAdapters from './adapters.mjs';
import { decodeUtf8 } from '../util/utf8.mjs';
import { ITERATOR_DONE, AsyncQueue } from './interfaces.mjs';
import { toUint8Array, joinUint8Arrays } from '../util/buffer.mjs';
import { isPromise, isFetchResponse, isIterable, isAsyncIterable, isReadableDOMStream, isReadableNodeStream } from '../util/compat.mjs';
/** @ignore */
export class AsyncByteQueue extends AsyncQueue {
    write(value) {
        if ((value = toUint8Array(value)).byteLength > 0) {
            return super.write(value);
        }
    }
    toString(sync = false) {
        return sync
            ? decodeUtf8(this.toUint8Array(true))
            : this.toUint8Array(false).then(decodeUtf8);
    }
    toUint8Array(sync = false) {
        return sync ? joinUint8Arrays(this._values)[0] : (() => __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const buffers = [];
            let byteLength = 0;
            try {
                for (var _d = true, _e = __asyncValues(this), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    buffers.push(chunk);
                    byteLength += chunk.byteLength;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return joinUint8Arrays(buffers, byteLength)[0];
        }))();
    }
}
/** @ignore */
export class ByteStream {
    constructor(source) {
        if (source) {
            this.source = new ByteStreamSource(streamAdapters.fromIterable(source));
        }
    }
    [Symbol.iterator]() { return this; }
    next(value) { return this.source.next(value); }
    throw(value) { return this.source.throw(value); }
    return(value) { return this.source.return(value); }
    peek(size) { return this.source.peek(size); }
    read(size) { return this.source.read(size); }
}
/** @ignore */
export class AsyncByteStream {
    constructor(source) {
        if (source instanceof AsyncByteStream) {
            this.source = source.source;
        }
        else if (source instanceof AsyncByteQueue) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        }
        else if (isReadableNodeStream(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromNodeStream(source));
        }
        else if (isReadableDOMStream(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromDOMStream(source));
        }
        else if (isFetchResponse(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromDOMStream(source.body));
        }
        else if (isIterable(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromIterable(source));
        }
        else if (isPromise(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        }
        else if (isAsyncIterable(source)) {
            this.source = new AsyncByteStreamSource(streamAdapters.fromAsyncIterable(source));
        }
    }
    [Symbol.asyncIterator]() { return this; }
    next(value) { return this.source.next(value); }
    throw(value) { return this.source.throw(value); }
    return(value) { return this.source.return(value); }
    get closed() { return this.source.closed; }
    cancel(reason) { return this.source.cancel(reason); }
    peek(size) { return this.source.peek(size); }
    read(size) { return this.source.read(size); }
}
/** @ignore */
class ByteStreamSource {
    constructor(source) {
        this.source = source;
    }
    cancel(reason) { this.return(reason); }
    peek(size) { return this.next(size, 'peek').value; }
    read(size) { return this.next(size, 'read').value; }
    next(size, cmd = 'read') { return this.source.next({ cmd, size }); }
    throw(value) { return Object.create((this.source.throw && this.source.throw(value)) || ITERATOR_DONE); }
    return(value) { return Object.create((this.source.return && this.source.return(value)) || ITERATOR_DONE); }
}
/** @ignore */
class AsyncByteStreamSource {
    constructor(source) {
        this.source = source;
        this._closedPromise = new Promise((r) => this._closedPromiseResolve = r);
    }
    cancel(reason) {
        return __awaiter(this, void 0, void 0, function* () { yield this.return(reason); });
    }
    get closed() { return this._closedPromise; }
    read(size) {
        return __awaiter(this, void 0, void 0, function* () { return (yield this.next(size, 'read')).value; });
    }
    peek(size) {
        return __awaiter(this, void 0, void 0, function* () { return (yield this.next(size, 'peek')).value; });
    }
    next(size_1) {
        return __awaiter(this, arguments, void 0, function* (size, cmd = 'read') { return (yield this.source.next({ cmd, size })); });
    }
    throw(value) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = (this.source.throw && (yield this.source.throw(value))) || ITERATOR_DONE;
            this._closedPromiseResolve && this._closedPromiseResolve();
            this._closedPromiseResolve = undefined;
            return Object.create(result);
        });
    }
    return(value) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = (this.source.return && (yield this.source.return(value))) || ITERATOR_DONE;
            this._closedPromiseResolve && this._closedPromiseResolve();
            this._closedPromiseResolve = undefined;
            return Object.create(result);
        });
    }
}

//# sourceMappingURL=stream.mjs.map
