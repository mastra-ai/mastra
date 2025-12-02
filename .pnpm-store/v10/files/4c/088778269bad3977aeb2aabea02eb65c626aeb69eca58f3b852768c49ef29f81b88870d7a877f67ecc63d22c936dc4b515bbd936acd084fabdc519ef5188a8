"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SparseObjectCodec = void 0;
const ifaces_1 = require("./ifaces");
const buffer_1 = require("../primitives/buffer");
const errors_1 = require("../errors");
class SparseObjectCodec extends ifaces_1.Codec {
    codecs;
    names;
    constructor(tid, codecs, names) {
        super(tid);
        this.codecs = codecs;
        this.names = names;
    }
    encode(buf, object, ctx) {
        const elemBuf = new buffer_1.WriteBuffer();
        let objLen = 0;
        for (const [key, val] of Object.entries(object)) {
            if (val !== undefined) {
                const i = this.names.indexOf(key);
                if (i === -1) {
                    throw new errors_1.UnknownArgumentError(this.names.length
                        ? `invalid global '${key}', valid globals are ${this.names
                            .map((n) => `'${n}'`)
                            .join(", ")}`
                        : `invalid global '${key}', no valid globals exist`);
                }
                objLen += 1;
                elemBuf.writeInt32(i);
                if (val === null) {
                    elemBuf.writeInt32(-1);
                }
                else {
                    this.codecs[i].encode(elemBuf, val, ctx);
                }
            }
        }
        const elemData = elemBuf.unwrap();
        buf.writeInt32(4 + elemData.length);
        buf.writeInt32(objLen);
        buf.writeBuffer(elemData);
    }
    decode(buf, ctx) {
        const codecs = this.codecs;
        const names = this.names;
        const els = buf.readUInt32();
        const elemBuf = buffer_1.ReadBuffer.alloc();
        const result = {};
        for (let _ = 0; _ < els; _++) {
            const i = buf.readUInt32();
            const elemLen = buf.readInt32();
            const name = names[i];
            let val = null;
            if (elemLen !== -1) {
                buf.sliceInto(elemBuf, elemLen);
                val = codecs[i].decode(elemBuf, ctx);
                elemBuf.finish();
            }
            result[name] = val;
        }
        return result;
    }
    getSubcodecs() {
        return Array.from(this.codecs);
    }
    getKind() {
        return "sparse_object";
    }
}
exports.SparseObjectCodec = SparseObjectCodec;
