"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNodeStream = void 0;
const tslib_1 = require("tslib");
const node_stream_1 = require("node:stream");
const compat_js_1 = require("../../util/compat.js");
/** @ignore */
function toNodeStream(source, options) {
    if ((0, compat_js_1.isAsyncIterable)(source)) {
        return new AsyncIterableReadable(source[Symbol.asyncIterator](), options);
    }
    if ((0, compat_js_1.isIterable)(source)) {
        return new IterableReadable(source[Symbol.iterator](), options);
    }
    /* istanbul ignore next */
    throw new Error(`toNodeStream() must be called with an Iterable or AsyncIterable`);
}
exports.toNodeStream = toNodeStream;
/** @ignore */
class IterableReadable extends node_stream_1.Readable {
    constructor(it, options) {
        super(options);
        this._iterator = it;
        this._pulling = false;
        this._bytesMode = !options || !options.objectMode;
    }
    _read(size) {
        const it = this._iterator;
        if (it && !this._pulling && (this._pulling = true)) {
            this._pulling = this._pull(size, it);
        }
    }
    _destroy(e, cb) {
        const it = this._iterator;
        let fn;
        it && (fn = e != null && it.throw || it.return);
        fn === null || fn === void 0 ? void 0 : fn.call(it, e);
        cb && cb(null);
    }
    _pull(size, it) {
        const bm = this._bytesMode;
        let r = null;
        while (this.readable && !(r = it.next(bm ? size : null)).done) {
            if (size != null) {
                size -= (bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1);
            }
            if (!this.push(r.value) || size <= 0) {
                break;
            }
        }
        if (((r === null || r === void 0 ? void 0 : r.done) || !this.readable) && (this.push(null) || true)) {
            it.return && it.return();
        }
        return !this.readable;
    }
}
/** @ignore */
class AsyncIterableReadable extends node_stream_1.Readable {
    constructor(it, options) {
        super(options);
        this._iterator = it;
        this._pulling = false;
        this._bytesMode = !options || !options.objectMode;
    }
    _read(size) {
        const it = this._iterator;
        if (it && !this._pulling && (this._pulling = true)) {
            (() => tslib_1.__awaiter(this, void 0, void 0, function* () { return this._pulling = yield this._pull(size, it); }))();
        }
    }
    _destroy(e, cb) {
        const it = this._iterator;
        let fn;
        it && (fn = e != null && it.throw || it.return);
        (fn === null || fn === void 0 ? void 0 : fn.call(it, e).then(() => cb && cb(null))) || (cb && cb(null));
    }
    _pull(size, it) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const bm = this._bytesMode;
            let r = null;
            while (this.readable && !(r = yield it.next(bm ? size : null)).done) {
                if (size != null) {
                    size -= (bm && ArrayBuffer.isView(r.value) ? r.value.byteLength : 1);
                }
                if (!this.push(r.value) || size <= 0) {
                    break;
                }
            }
            if (((r === null || r === void 0 ? void 0 : r.done) || !this.readable) && (this.push(null) || true)) {
                it.return && it.return();
            }
            return !this.readable;
        });
    }
}

//# sourceMappingURL=iterable.js.map
