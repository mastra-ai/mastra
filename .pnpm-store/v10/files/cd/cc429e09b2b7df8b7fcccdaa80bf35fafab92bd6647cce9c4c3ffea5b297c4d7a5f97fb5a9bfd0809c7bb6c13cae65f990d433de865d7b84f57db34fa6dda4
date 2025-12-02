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
exports.ObjectCodec = void 0;
const ifaces_1 = require("../ifaces");
const ifaces_2 = require("./ifaces");
const buffer_1 = require("../primitives/buffer");
const errors_1 = require("../errors");
const EDGE_POINTER_IS_IMPLICIT = 1 << 0;
const EDGE_POINTER_IS_LINKPROP = 1 << 1;
class ObjectCodec extends ifaces_2.Codec {
    codecs;
    fields;
    namesSet;
    cardinalities;
    constructor(tid, codecs, names, flags, cards) {
        super(tid);
        this.codecs = codecs;
        this.fields = new Array(names.length);
        this.namesSet = new Set();
        this.cardinalities = cards;
        for (let i = 0; i < names.length; i++) {
            const isLinkprop = !!(flags[i] & EDGE_POINTER_IS_LINKPROP);
            const name = isLinkprop ? `@${names[i]}` : names[i];
            this.fields[i] = {
                name,
                implicit: !!(flags[i] & EDGE_POINTER_IS_IMPLICIT),
                linkprop: isLinkprop,
                cardinality: cards[i],
            };
            this.namesSet.add(name);
        }
    }
    encode(_buf, _object) {
        throw new errors_1.InvalidArgumentError("Objects cannot be passed as arguments");
    }
    encodeArgs(args, ctx) {
        if (this.fields[0].name === "0" || this.fields[0].name === "1") {
            return this._encodePositionalArgs(args, ctx);
        }
        return this._encodeNamedArgs(args, ctx);
    }
    _encodePositionalArgs(args, ctx) {
        if (!Array.isArray(args)) {
            throw new errors_1.InvalidArgumentError("an array of arguments was expected");
        }
        const codecs = this.codecs;
        const codecsLen = codecs.length;
        if (args.length !== codecsLen) {
            throw new errors_1.QueryArgumentError(`expected ${codecsLen} argument${codecsLen === 1 ? "" : "s"}, got ${args.length}`);
        }
        const elemData = new buffer_1.WriteBuffer();
        for (let i = 0; i < codecsLen; i++) {
            elemData.writeInt32(0);
            const arg = args[i];
            if (arg == null) {
                const card = this.cardinalities[i];
                if (card === ifaces_1.Cardinality.ONE || card === ifaces_1.Cardinality.AT_LEAST_ONE) {
                    throw new errors_1.MissingArgumentError(`argument ${this.fields[i].name} is required, but received ${arg}`);
                }
                elemData.writeInt32(-1);
            }
            else {
                const codec = codecs[i];
                codec.encode(elemData, arg, ctx);
            }
        }
        const elemBuf = elemData.unwrap();
        const buf = new buffer_1.WriteBuffer();
        buf.writeInt32(4 + elemBuf.length);
        buf.writeInt32(codecsLen);
        buf.writeBuffer(elemBuf);
        return buf.unwrap();
    }
    _encodeNamedArgs(args, ctx) {
        if (args == null) {
            throw new errors_1.MissingArgumentError("One or more named arguments expected, received null");
        }
        const keys = Object.keys(args);
        const fields = this.fields;
        const namesSet = this.namesSet;
        const codecs = this.codecs;
        const codecsLen = codecs.length;
        if (keys.length > codecsLen) {
            const extraKeys = keys.filter((key) => !namesSet.has(key));
            throw new errors_1.UnknownArgumentError(`Unused named argument${extraKeys.length === 1 ? "" : "s"}: "${extraKeys.join('", "')}"`);
        }
        const elemData = new buffer_1.WriteBuffer();
        for (let i = 0; i < codecsLen; i++) {
            const key = fields[i].name;
            const val = args[key];
            elemData.writeInt32(0);
            if (val == null) {
                const card = this.cardinalities[i];
                if (card === ifaces_1.Cardinality.ONE || card === ifaces_1.Cardinality.AT_LEAST_ONE) {
                    throw new errors_1.MissingArgumentError(`argument ${this.fields[i].name} is required, but received ${val}`);
                }
                elemData.writeInt32(-1);
            }
            else {
                const codec = codecs[i];
                codec.encode(elemData, val, ctx);
            }
        }
        const elemBuf = elemData.unwrap();
        const buf = new buffer_1.WriteBuffer();
        buf.writeInt32(4 + elemBuf.length);
        buf.writeInt32(codecsLen);
        buf.writeBuffer(elemBuf);
        return buf.unwrap();
    }
    decode(buf, ctx) {
        const codecs = this.codecs;
        const fields = this.fields;
        const els = buf.readUInt32();
        if (els !== codecs.length) {
            throw new errors_1.ProtocolError(`cannot decode Object: expected ${codecs.length} elements, got ${els}`);
        }
        const elemBuf = buffer_1.ReadBuffer.alloc();
        const result = {};
        for (let i = 0; i < els; i++) {
            buf.discard(4);
            const elemLen = buf.readInt32();
            const name = fields[i].name;
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
    getFields() {
        return Array.from(this.fields);
    }
    getKind() {
        return "object";
    }
}
exports.ObjectCodec = ObjectCodec;
