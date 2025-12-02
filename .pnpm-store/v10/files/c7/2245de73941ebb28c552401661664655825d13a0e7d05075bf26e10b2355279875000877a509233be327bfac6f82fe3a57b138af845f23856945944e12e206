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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodecsRegistry = void 0;
const buffer_1 = require("../primitives/buffer");
const lru_1 = __importDefault(require("../primitives/lru"));
const ifaces_1 = require("./ifaces");
const codecs_1 = require("./codecs");
const consts_1 = require("./consts");
const tuple_1 = require("./tuple");
const array_1 = require("./array");
const namedtuple_1 = require("./namedtuple");
const enum_1 = require("./enum");
const object_1 = require("./object");
const set_1 = require("./set");
const record_1 = require("./record");
const range_1 = require("./range");
const utils_1 = require("../utils");
const sparseObject_1 = require("./sparseObject");
const errors_1 = require("../errors");
const CODECS_CACHE_SIZE = 1000;
const CODECS_BUILD_CACHE_SIZE = 200;
const CTYPE_SET = 0;
const CTYPE_SHAPE = 1;
const CTYPE_BASE_SCALAR = 2;
const CTYPE_SCALAR = 3;
const CTYPE_TUPLE = 4;
const CTYPE_NAMEDTUPLE = 5;
const CTYPE_ARRAY = 6;
const CTYPE_ENUM = 7;
const CTYPE_INPUT_SHAPE = 8;
const CTYPE_RANGE = 9;
const CTYPE_OBJECT = 10;
const CTYPE_COMPOUND = 11;
const CTYPE_MULTIRANGE = 12;
const CTYPE_RECORD = 13;
class CodecsRegistry {
    codecsBuildCache;
    codecs;
    constructor() {
        this.codecs = new lru_1.default({ capacity: CODECS_CACHE_SIZE });
        this.codecsBuildCache = new lru_1.default({ capacity: CODECS_BUILD_CACHE_SIZE });
    }
    hasCodec(typeId) {
        if (this.codecs.has(typeId)) {
            return true;
        }
        return typeId === consts_1.NULL_CODEC_ID || typeId === tuple_1.EMPTY_TUPLE_CODEC_ID;
    }
    getCodec(typeId) {
        const codec = this.codecs.get(typeId);
        if (codec != null) {
            return codec;
        }
        if (typeId === tuple_1.EMPTY_TUPLE_CODEC_ID) {
            return tuple_1.EMPTY_TUPLE_CODEC;
        }
        if (typeId === consts_1.NULL_CODEC_ID) {
            return codecs_1.NULL_CODEC;
        }
        return null;
    }
    buildCodec(spec, protocolVersion) {
        if (!(0, utils_1.versionGreaterThanOrEqual)(protocolVersion, [2, 0])) {
            throw new errors_1.UnsupportedProtocolVersionError("unsupported old protocol version v1; downgrade to the previous " +
                "version of gel-js");
        }
        const frb = new buffer_1.ReadBuffer(spec);
        const codecsList = [];
        let codec = null;
        while (frb.length) {
            const descLen = frb.readInt32();
            const descBuf = buffer_1.ReadBuffer.alloc();
            frb.sliceInto(descBuf, descLen);
            codec = this._buildCodec(descBuf, codecsList);
            descBuf.finish("unexpected trailing data in type descriptor buffer");
            if (codec == null) {
                continue;
            }
            codecsList.push(codec);
            this.codecs.set(codec.tid, codec);
        }
        if (!codecsList.length) {
            throw new errors_1.InternalClientError("could not build a codec");
        }
        return codecsList[codecsList.length - 1];
    }
    _buildCodec(frb, cl) {
        const t = frb.readUInt8();
        const tid = frb.readUUID();
        let res = this.codecs.get(tid);
        if (res == null) {
            res = this.codecsBuildCache.get(tid);
        }
        if (res != null) {
            frb.discard(frb.length);
            return res;
        }
        switch (t) {
            case CTYPE_BASE_SCALAR: {
                res = codecs_1.SCALAR_CODECS.get(tid);
                if (!res) {
                    if (consts_1.KNOWN_TYPES.has(tid)) {
                        throw new errors_1.InternalClientError(`no JS codec for ${consts_1.KNOWN_TYPES.get(tid)}`);
                    }
                    throw new errors_1.InternalClientError(`no JS codec for the type with ID ${tid}`);
                }
                if (!(res instanceof ifaces_1.ScalarCodec)) {
                    throw new errors_1.ProtocolError("could not build scalar codec: base scalar is a non-scalar codec");
                }
                break;
            }
            case CTYPE_SHAPE:
            case CTYPE_INPUT_SHAPE: {
                if (t === CTYPE_SHAPE) {
                    frb.readBoolean();
                    frb.readUInt16();
                }
                const els = frb.readUInt16();
                const codecs = new Array(els);
                const names = new Array(els);
                const flags = new Array(els);
                const cards = new Array(els);
                for (let i = 0; i < els; i++) {
                    const flag = frb.readUInt32();
                    const card = frb.readUInt8();
                    const name = frb.readString();
                    const pos = frb.readUInt16();
                    const subCodec = cl[pos];
                    if (subCodec == null) {
                        throw new errors_1.ProtocolError("could not build object codec: missing subcodec");
                    }
                    codecs[i] = subCodec;
                    names[i] = name;
                    flags[i] = flag;
                    cards[i] = card;
                    if (t === CTYPE_SHAPE) {
                        frb.readUInt16();
                    }
                }
                res =
                    t === CTYPE_INPUT_SHAPE
                        ? new sparseObject_1.SparseObjectCodec(tid, codecs, names)
                        : new object_1.ObjectCodec(tid, codecs, names, flags, cards);
                break;
            }
            case CTYPE_SET: {
                const pos = frb.readUInt16();
                const subCodec = cl[pos];
                if (subCodec == null) {
                    throw new errors_1.ProtocolError("could not build set codec: missing subcodec");
                }
                res = new set_1.SetCodec(tid, subCodec);
                break;
            }
            case CTYPE_SCALAR: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                const ancestors = [];
                for (let i = 0; i < ancestorCount; i++) {
                    const ancestorPos = frb.readUInt16();
                    const ancestorCodec = cl[ancestorPos];
                    if (ancestorCodec == null) {
                        throw new errors_1.ProtocolError("could not build scalar codec: missing a codec for base scalar");
                    }
                    if (!(ancestorCodec instanceof ifaces_1.ScalarCodec)) {
                        throw new errors_1.ProtocolError(`a scalar codec expected for base scalar type, ` +
                            `got ${ancestorCodec}`);
                    }
                    ancestors.push(ancestorCodec);
                }
                if (ancestorCount === 0) {
                    res = codecs_1.SCALAR_CODECS.get(tid);
                    if (res == null) {
                        if (consts_1.KNOWN_TYPES.has(tid)) {
                            throw new errors_1.InternalClientError(`no JS codec for ${consts_1.KNOWN_TYPES.get(tid)}`);
                        }
                        throw new errors_1.InternalClientError(`no JS codec for the type with ID ${tid}`);
                    }
                }
                else {
                    const baseCodec = ancestors[ancestors.length - 1];
                    res = baseCodec.derive(tid, typeName, ancestors);
                }
                break;
            }
            case CTYPE_ARRAY: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const pos = frb.readUInt16();
                const els = frb.readUInt16();
                if (els !== 1) {
                    throw new errors_1.ProtocolError("cannot handle arrays with more than one dimension");
                }
                const dimLen = frb.readInt32();
                const subCodec = cl[pos];
                if (subCodec == null) {
                    throw new errors_1.ProtocolError("could not build array codec: missing subcodec");
                }
                res = new array_1.ArrayCodec(tid, typeName, subCodec, dimLen);
                break;
            }
            case CTYPE_TUPLE: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const els = frb.readUInt16();
                if (els === 0) {
                    res = tuple_1.EMPTY_TUPLE_CODEC;
                }
                else {
                    const codecs = new Array(els);
                    for (let i = 0; i < els; i++) {
                        const pos = frb.readUInt16();
                        const subCodec = cl[pos];
                        if (subCodec == null) {
                            throw new errors_1.ProtocolError("could not build tuple codec: missing subcodec");
                        }
                        codecs[i] = subCodec;
                    }
                    res = new tuple_1.TupleCodec(tid, typeName, codecs);
                }
                break;
            }
            case CTYPE_NAMEDTUPLE: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const els = frb.readUInt16();
                const codecs = new Array(els);
                const names = new Array(els);
                for (let i = 0; i < els; i++) {
                    names[i] = frb.readString();
                    const pos = frb.readUInt16();
                    const subCodec = cl[pos];
                    if (subCodec == null) {
                        throw new errors_1.ProtocolError("could not build namedtuple codec: missing subcodec");
                    }
                    codecs[i] = subCodec;
                }
                res = new namedtuple_1.NamedTupleCodec(tid, typeName, codecs, names);
                break;
            }
            case CTYPE_RECORD: {
                const els = frb.readUInt16();
                const codecs = new Array(els);
                const names = new Array(els);
                for (let i = 0; i < els; i++) {
                    names[i] = frb.readString();
                    const pos = frb.readUInt16();
                    const subCodec = cl[pos];
                    if (subCodec == null) {
                        throw new errors_1.ProtocolError("could not build record codec: missing subcodec");
                    }
                    codecs[i] = subCodec;
                }
                res = new record_1.RecordCodec(tid, codecs, names);
                break;
            }
            case CTYPE_ENUM: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const els = frb.readUInt16();
                const values = [];
                for (let i = 0; i < els; i++) {
                    values.push(frb.readString());
                }
                res = new enum_1.EnumCodec(tid, typeName, values);
                break;
            }
            case CTYPE_RANGE: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const pos = frb.readUInt16();
                const subCodec = cl[pos];
                if (subCodec == null) {
                    throw new errors_1.ProtocolError("could not build range codec: missing subcodec");
                }
                res = new range_1.RangeCodec(tid, typeName, subCodec);
                break;
            }
            case CTYPE_OBJECT: {
                frb.discard(frb.length);
                res = codecs_1.NULL_CODEC;
                break;
            }
            case CTYPE_COMPOUND: {
                frb.discard(frb.length);
                res = codecs_1.NULL_CODEC;
                break;
            }
            case CTYPE_MULTIRANGE: {
                const typeName = frb.readString();
                frb.readBoolean();
                const ancestorCount = frb.readUInt16();
                for (let i = 0; i < ancestorCount; i++) {
                    frb.readUInt16();
                }
                const pos = frb.readUInt16();
                const subCodec = cl[pos];
                if (subCodec == null) {
                    throw new errors_1.ProtocolError("could not build range codec: missing subcodec");
                }
                res = new range_1.MultiRangeCodec(tid, typeName, subCodec);
                break;
            }
        }
        if (res == null) {
            if (consts_1.KNOWN_TYPES.has(tid)) {
                throw new errors_1.InternalClientError(`could not build a codec for ${consts_1.KNOWN_TYPES.get(tid)} type`);
            }
            else {
                throw new errors_1.InternalClientError(`could not build a codec for ${tid} type`);
            }
        }
        this.codecsBuildCache.set(tid, res);
        return res;
    }
}
exports.CodecsRegistry = CodecsRegistry;
