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
exports.RecordCodec = exports.SQLRowModeObject = exports.SQLRowModeArray = void 0;
const ifaces_1 = require("./ifaces");
const buffer_1 = require("../primitives/buffer");
const errors_1 = require("../errors");
const SQLRowArrayCodec = {
    fromDatabase(values, _desc) {
        return values;
    },
    toDatabase() {
        throw new errors_1.InternalClientError("cannot encode SQL record as a query argument");
    },
};
const SQLRowObjectCodec = {
    fromDatabase(values, { names }) {
        return Object.fromEntries(names.map((key, index) => [key, values[index]]));
    },
    toDatabase() {
        throw new errors_1.InternalClientError("cannot encode SQL record as a query argument");
    },
};
exports.SQLRowModeArray = {
    _private_sql_row: SQLRowArrayCodec,
};
exports.SQLRowModeObject = {
    _private_sql_row: SQLRowObjectCodec,
};
class RecordCodec extends ifaces_1.Codec {
    subCodecs;
    names;
    constructor(tid, codecs, names) {
        super(tid);
        this.subCodecs = codecs;
        this.names = names;
    }
    encode(_buf, _object) {
        throw new errors_1.InvalidArgumentError("SQL records cannot be passed as arguments");
    }
    decode(buf, ctx) {
        const els = buf.readUInt32();
        const subCodecs = this.subCodecs;
        if (els !== subCodecs.length) {
            throw new errors_1.ProtocolError(`cannot decode Record: expected ` +
                `${subCodecs.length} elements, got ${els}`);
        }
        const elemBuf = buffer_1.ReadBuffer.alloc();
        const overload = ctx.getContainerOverload("_private_sql_row");
        if (overload != null && overload !== SQLRowObjectCodec) {
            const result = new Array(els);
            for (let i = 0; i < els; i++) {
                buf.discard(4);
                const elemLen = buf.readInt32();
                let val = null;
                if (elemLen !== -1) {
                    buf.sliceInto(elemBuf, elemLen);
                    val = subCodecs[i].decode(elemBuf, ctx);
                    elemBuf.finish();
                }
                result[i] = val;
            }
            if (overload !== SQLRowArrayCodec) {
                return overload.fromDatabase(result, { names: this.names });
            }
            return result;
        }
        else {
            const names = this.names;
            const result = {};
            for (let i = 0; i < els; i++) {
                buf.discard(4);
                const elemLen = buf.readInt32();
                let val = null;
                if (elemLen !== -1) {
                    buf.sliceInto(elemBuf, elemLen);
                    val = subCodecs[i].decode(elemBuf, ctx);
                    elemBuf.finish();
                }
                result[names[i]] = val;
            }
            return result;
        }
    }
    getSubcodecs() {
        return Array.from(this.subCodecs);
    }
    getNames() {
        return Array.from(this.names);
    }
    getKind() {
        return "record";
    }
}
exports.RecordCodec = RecordCodec;
