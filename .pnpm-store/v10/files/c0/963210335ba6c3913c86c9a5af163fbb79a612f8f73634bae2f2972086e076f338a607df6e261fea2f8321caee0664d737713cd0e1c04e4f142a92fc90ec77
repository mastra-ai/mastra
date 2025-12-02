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
import { __awaiter } from "tslib";
import { Duplex } from 'node:stream';
import { AsyncByteStream } from '../../io/stream.mjs';
/** @ignore */
export function recordBatchWriterThroughNodeStream(options) {
    return new RecordBatchWriterDuplex(new this(options));
}
/** @ignore */
class RecordBatchWriterDuplex extends Duplex {
    constructor(writer, options) {
        super(Object.assign(Object.assign({ allowHalfOpen: false }, options), { writableObjectMode: true, readableObjectMode: false }));
        this._pulling = false;
        this._writer = writer;
        this._reader = new AsyncByteStream(writer);
    }
    _final(cb) {
        const writer = this._writer;
        writer === null || writer === void 0 ? void 0 : writer.close();
        cb && cb();
    }
    _write(x, _, cb) {
        const writer = this._writer;
        writer === null || writer === void 0 ? void 0 : writer.write(x);
        cb && cb();
        return true;
    }
    _read(size) {
        const it = this._reader;
        if (it && !this._pulling && (this._pulling = true)) {
            (() => __awaiter(this, void 0, void 0, function* () { return this._pulling = yield this._pull(size, it); }))();
        }
    }
    _destroy(err, cb) {
        const writer = this._writer;
        if (writer) {
            err ? writer.abort(err) : writer.close();
        }
        cb(this._reader = this._writer = null);
    }
    _pull(size, reader) {
        return __awaiter(this, void 0, void 0, function* () {
            let r = null;
            while (this.readable && !(r = yield reader.next(size || null)).done) {
                if (size != null && r.value) {
                    size -= r.value.byteLength;
                }
                if (!this.push(r.value) || size <= 0) {
                    break;
                }
            }
            if (((r === null || r === void 0 ? void 0 : r.done) || !this.readable)) {
                this.push(null);
                yield reader.cancel();
            }
            return !this.readable;
        });
    }
}

//# sourceMappingURL=writer.mjs.map
