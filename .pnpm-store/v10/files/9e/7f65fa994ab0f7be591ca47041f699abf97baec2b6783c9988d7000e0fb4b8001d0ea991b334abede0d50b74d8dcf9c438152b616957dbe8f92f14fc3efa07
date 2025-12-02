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
exports.recordBatchReaderThroughNodeStream = void 0;
const tslib_1 = require("tslib");
const node_stream_1 = require("node:stream");
const stream_js_1 = require("../../io/stream.js");
const reader_js_1 = require("../../ipc/reader.js");
/** @ignore */
function recordBatchReaderThroughNodeStream(options) {
    return new RecordBatchReaderDuplex(options);
}
exports.recordBatchReaderThroughNodeStream = recordBatchReaderThroughNodeStream;
/** @ignore */
class RecordBatchReaderDuplex extends node_stream_1.Duplex {
    constructor(options) {
        super(Object.assign(Object.assign({ allowHalfOpen: false }, options), { readableObjectMode: true, writableObjectMode: false }));
        this._pulling = false;
        this._autoDestroy = true;
        this._reader = null;
        this._pulling = false;
        this._asyncQueue = new stream_js_1.AsyncByteQueue();
        this._autoDestroy = options && (typeof options.autoDestroy === 'boolean') ? options.autoDestroy : true;
    }
    _final(cb) {
        const aq = this._asyncQueue;
        aq === null || aq === void 0 ? void 0 : aq.close();
        cb && cb();
    }
    _write(x, _, cb) {
        const aq = this._asyncQueue;
        aq === null || aq === void 0 ? void 0 : aq.write(x);
        cb && cb();
        return true;
    }
    _read(size) {
        const aq = this._asyncQueue;
        if (aq && !this._pulling && (this._pulling = true)) {
            (() => tslib_1.__awaiter(this, void 0, void 0, function* () {
                if (!this._reader) {
                    this._reader = yield this._open(aq);
                }
                this._pulling = yield this._pull(size, this._reader);
            }))();
        }
    }
    _destroy(err, cb) {
        const aq = this._asyncQueue;
        if (aq) {
            err ? aq.abort(err) : aq.close();
        }
        cb(this._asyncQueue = this._reader = null);
    }
    _open(source) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield (yield reader_js_1.RecordBatchReader.from(source)).open({ autoDestroy: this._autoDestroy });
        });
    }
    _pull(size, reader) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let r = null;
            while (this.readable && !(r = yield reader.next()).done) {
                if (!this.push(r.value) || (size != null && --size <= 0)) {
                    break;
                }
            }
            if (!this.readable || ((r === null || r === void 0 ? void 0 : r.done) && (reader.autoDestroy || (yield reader.reset().open()).closed))) {
                this.push(null);
                yield reader.cancel();
            }
            return !this.readable;
        });
    }
}

//# sourceMappingURL=reader.js.map
