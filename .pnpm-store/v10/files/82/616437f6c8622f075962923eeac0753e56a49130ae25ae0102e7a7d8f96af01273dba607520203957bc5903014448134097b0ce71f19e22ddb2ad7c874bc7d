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
exports.ArrayCodec = void 0;
const ifaces_1 = require("./ifaces");
const buffer_1 = require("../primitives/buffer");
const tuple_1 = require("./tuple");
const range_1 = require("./range");
const errors_1 = require("../errors");
const namedtuple_1 = require("./namedtuple");
class ArrayCodec extends ifaces_1.Codec {
    subCodec;
    len;
    typeName;
    constructor(tid, typeName, subCodec, len) {
        super(tid);
        this.subCodec = subCodec;
        this.len = len;
        this.typeName = typeName;
    }
    encode(buf, obj, ctx) {
        if (!(this.subCodec instanceof ifaces_1.ScalarCodec ||
            this.subCodec instanceof tuple_1.TupleCodec ||
            this.subCodec instanceof namedtuple_1.NamedTupleCodec ||
            this.subCodec instanceof range_1.RangeCodec ||
            this.subCodec instanceof range_1.MultiRangeCodec)) {
            throw new errors_1.InvalidArgumentError("only arrays of scalars or tuples are supported");
        }
        if (!Array.isArray(obj) && !isTypedArray(obj)) {
            throw new errors_1.InvalidArgumentError(`an array was expected (got type ${obj.constructor.name})`);
        }
        const subCodec = this.subCodec;
        const elemData = new buffer_1.WriteBuffer();
        const objLen = obj.length;
        if (objLen > 0x7fffffff) {
            throw new errors_1.InvalidArgumentError("too many elements in array");
        }
        for (let i = 0; i < objLen; i++) {
            const item = obj[i];
            if (item == null) {
                elemData.writeInt32(-1);
            }
            else {
                subCodec.encode(elemData, item, ctx);
            }
        }
        const elemBuf = elemData.unwrap();
        buf.writeInt32(12 + 8 + elemBuf.length);
        buf.writeInt32(1);
        buf.writeInt32(0);
        buf.writeInt32(0);
        buf.writeInt32(objLen);
        buf.writeInt32(1);
        buf.writeBuffer(elemBuf);
    }
    decode(buf, ctx) {
        const ndims = buf.readInt32();
        buf.discard(4);
        buf.discard(4);
        if (ndims === 0) {
            return [];
        }
        if (ndims !== 1) {
            throw new errors_1.ProtocolError("only 1-dimensional arrays are supported");
        }
        const len = buf.readUInt32();
        if (this.len !== -1 && len !== this.len) {
            throw new errors_1.ProtocolError(`invalid array size: received ${len}, expected ${this.len}`);
        }
        buf.discard(4);
        const result = new Array(len);
        const elemBuf = buffer_1.ReadBuffer.alloc();
        const subCodec = this.subCodec;
        for (let i = 0; i < len; i++) {
            const elemLen = buf.readInt32();
            if (elemLen === -1) {
                result[i] = null;
            }
            else {
                buf.sliceInto(elemBuf, elemLen);
                result[i] = subCodec.decode(elemBuf, ctx);
                elemBuf.finish();
            }
        }
        return result;
    }
    getSubcodecs() {
        return [this.subCodec];
    }
    getKind() {
        return "array";
    }
}
exports.ArrayCodec = ArrayCodec;
function isTypedArray(obj) {
    return !!(obj.buffer instanceof ArrayBuffer && obj.BYTES_PER_ELEMENT);
}
