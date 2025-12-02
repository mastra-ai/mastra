"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryReader = exports.BinaryWriter = exports.INT32_MIN = exports.INT32_MAX = exports.UINT32_MAX = exports.FLOAT32_MIN = exports.FLOAT32_MAX = exports.WireType = void 0;
const varint_js_1 = require("./varint.js");
const proto_int64_js_1 = require("../proto-int64.js");
const text_encoding_js_1 = require("./text-encoding.js");
/**
 * Protobuf binary format wire types.
 *
 * A wire type provides just enough information to find the length of the
 * following value.
 *
 * See https://developers.google.com/protocol-buffers/docs/encoding#structure
 */
var WireType;
(function (WireType) {
    /**
     * Used for int32, int64, uint32, uint64, sint32, sint64, bool, enum
     */
    WireType[WireType["Varint"] = 0] = "Varint";
    /**
     * Used for fixed64, sfixed64, double.
     * Always 8 bytes with little-endian byte order.
     */
    WireType[WireType["Bit64"] = 1] = "Bit64";
    /**
     * Used for string, bytes, embedded messages, packed repeated fields
     *
     * Only repeated numeric types (types which use the varint, 32-bit,
     * or 64-bit wire types) can be packed. In proto3, such fields are
     * packed by default.
     */
    WireType[WireType["LengthDelimited"] = 2] = "LengthDelimited";
    /**
     * Start of a tag-delimited aggregate, such as a proto2 group, or a message
     * in editions with message_encoding = DELIMITED.
     */
    WireType[WireType["StartGroup"] = 3] = "StartGroup";
    /**
     * End of a tag-delimited aggregate.
     */
    WireType[WireType["EndGroup"] = 4] = "EndGroup";
    /**
     * Used for fixed32, sfixed32, float.
     * Always 4 bytes with little-endian byte order.
     */
    WireType[WireType["Bit32"] = 5] = "Bit32";
})(WireType || (exports.WireType = WireType = {}));
/**
 * Maximum value for a 32-bit floating point value (Protobuf FLOAT).
 */
exports.FLOAT32_MAX = 3.4028234663852886e38;
/**
 * Minimum value for a 32-bit floating point value (Protobuf FLOAT).
 */
exports.FLOAT32_MIN = -3.4028234663852886e38;
/**
 * Maximum value for an unsigned 32-bit integer (Protobuf UINT32, FIXED32).
 */
exports.UINT32_MAX = 0xffffffff;
/**
 * Maximum value for a signed 32-bit integer (Protobuf INT32, SFIXED32, SINT32).
 */
exports.INT32_MAX = 0x7fffffff;
/**
 * Minimum value for a signed 32-bit integer (Protobuf INT32, SFIXED32, SINT32).
 */
exports.INT32_MIN = -0x80000000;
class BinaryWriter {
    constructor(encodeUtf8 = (0, text_encoding_js_1.getTextEncoding)().encodeUtf8) {
        this.encodeUtf8 = encodeUtf8;
        /**
         * Previous fork states.
         */
        this.stack = [];
        this.chunks = [];
        this.buf = [];
    }
    /**
     * Return all bytes written and reset this writer.
     */
    finish() {
        if (this.buf.length) {
            this.chunks.push(new Uint8Array(this.buf)); // flush the buffer
            this.buf = [];
        }
        let len = 0;
        for (let i = 0; i < this.chunks.length; i++)
            len += this.chunks[i].length;
        let bytes = new Uint8Array(len);
        let offset = 0;
        for (let i = 0; i < this.chunks.length; i++) {
            bytes.set(this.chunks[i], offset);
            offset += this.chunks[i].length;
        }
        this.chunks = [];
        return bytes;
    }
    /**
     * Start a new fork for length-delimited data like a message
     * or a packed repeated field.
     *
     * Must be joined later with `join()`.
     */
    fork() {
        this.stack.push({ chunks: this.chunks, buf: this.buf });
        this.chunks = [];
        this.buf = [];
        return this;
    }
    /**
     * Join the last fork. Write its length and bytes, then
     * return to the previous state.
     */
    join() {
        // get chunk of fork
        let chunk = this.finish();
        // restore previous state
        let prev = this.stack.pop();
        if (!prev)
            throw new Error("invalid state, fork stack empty");
        this.chunks = prev.chunks;
        this.buf = prev.buf;
        // write length of chunk as varint
        this.uint32(chunk.byteLength);
        return this.raw(chunk);
    }
    /**
     * Writes a tag (field number and wire type).
     *
     * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
     *
     * Generated code should compute the tag ahead of time and call `uint32()`.
     */
    tag(fieldNo, type) {
        return this.uint32(((fieldNo << 3) | type) >>> 0);
    }
    /**
     * Write a chunk of raw bytes.
     */
    raw(chunk) {
        if (this.buf.length) {
            this.chunks.push(new Uint8Array(this.buf));
            this.buf = [];
        }
        this.chunks.push(chunk);
        return this;
    }
    /**
     * Write a `uint32` value, an unsigned 32 bit varint.
     */
    uint32(value) {
        assertUInt32(value);
        // write value as varint 32, inlined for speed
        while (value > 0x7f) {
            this.buf.push((value & 0x7f) | 0x80);
            value = value >>> 7;
        }
        this.buf.push(value);
        return this;
    }
    /**
     * Write a `int32` value, a signed 32 bit varint.
     */
    int32(value) {
        assertInt32(value);
        (0, varint_js_1.varint32write)(value, this.buf);
        return this;
    }
    /**
     * Write a `bool` value, a variant.
     */
    bool(value) {
        this.buf.push(value ? 1 : 0);
        return this;
    }
    /**
     * Write a `bytes` value, length-delimited arbitrary data.
     */
    bytes(value) {
        this.uint32(value.byteLength); // write length of chunk as varint
        return this.raw(value);
    }
    /**
     * Write a `string` value, length-delimited data converted to UTF-8 text.
     */
    string(value) {
        let chunk = this.encodeUtf8(value);
        this.uint32(chunk.byteLength); // write length of chunk as varint
        return this.raw(chunk);
    }
    /**
     * Write a `float` value, 32-bit floating point number.
     */
    float(value) {
        assertFloat32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setFloat32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `double` value, a 64-bit floating point number.
     */
    double(value) {
        let chunk = new Uint8Array(8);
        new DataView(chunk.buffer).setFloat64(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
     */
    fixed32(value) {
        assertUInt32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setUint32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
     */
    sfixed32(value) {
        assertInt32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setInt32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
     */
    sint32(value) {
        assertInt32(value);
        // zigzag encode
        value = ((value << 1) ^ (value >> 31)) >>> 0;
        (0, varint_js_1.varint32write)(value, this.buf);
        return this;
    }
    /**
     * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
     */
    sfixed64(value) {
        let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = proto_int64_js_1.protoInt64.enc(value);
        view.setInt32(0, tc.lo, true);
        view.setInt32(4, tc.hi, true);
        return this.raw(chunk);
    }
    /**
     * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
     */
    fixed64(value) {
        let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = proto_int64_js_1.protoInt64.uEnc(value);
        view.setInt32(0, tc.lo, true);
        view.setInt32(4, tc.hi, true);
        return this.raw(chunk);
    }
    /**
     * Write a `int64` value, a signed 64-bit varint.
     */
    int64(value) {
        let tc = proto_int64_js_1.protoInt64.enc(value);
        (0, varint_js_1.varint64write)(tc.lo, tc.hi, this.buf);
        return this;
    }
    /**
     * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64(value) {
        const tc = proto_int64_js_1.protoInt64.enc(value), 
        // zigzag encode
        sign = tc.hi >> 31, lo = (tc.lo << 1) ^ sign, hi = ((tc.hi << 1) | (tc.lo >>> 31)) ^ sign;
        (0, varint_js_1.varint64write)(lo, hi, this.buf);
        return this;
    }
    /**
     * Write a `uint64` value, an unsigned 64-bit varint.
     */
    uint64(value) {
        const tc = proto_int64_js_1.protoInt64.uEnc(value);
        (0, varint_js_1.varint64write)(tc.lo, tc.hi, this.buf);
        return this;
    }
}
exports.BinaryWriter = BinaryWriter;
class BinaryReader {
    constructor(buf, decodeUtf8 = (0, text_encoding_js_1.getTextEncoding)().decodeUtf8) {
        this.decodeUtf8 = decodeUtf8;
        this.varint64 = varint_js_1.varint64read; // dirty cast for `this`
        /**
         * Read a `uint32` field, an unsigned 32 bit varint.
         */
        this.uint32 = varint_js_1.varint32read;
        this.buf = buf;
        this.len = buf.length;
        this.pos = 0;
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    /**
     * Reads a tag - field number and wire type.
     */
    tag() {
        let tag = this.uint32(), fieldNo = tag >>> 3, wireType = tag & 7;
        if (fieldNo <= 0 || wireType < 0 || wireType > 5)
            throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
        return [fieldNo, wireType];
    }
    /**
     * Skip one element and return the skipped data.
     *
     * When skipping StartGroup, provide the tags field number to check for
     * matching field number in the EndGroup tag.
     */
    skip(wireType, fieldNo) {
        let start = this.pos;
        switch (wireType) {
            case WireType.Varint:
                while (this.buf[this.pos++] & 0x80) {
                    // ignore
                }
                break;
            // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
            case WireType.Bit64:
                this.pos += 4;
            case WireType.Bit32:
                this.pos += 4;
                break;
            case WireType.LengthDelimited:
                let len = this.uint32();
                this.pos += len;
                break;
            case WireType.StartGroup:
                for (;;) {
                    const [fn, wt] = this.tag();
                    if (wt === WireType.EndGroup) {
                        if (fieldNo !== undefined && fn !== fieldNo) {
                            throw new Error("invalid end group tag");
                        }
                        break;
                    }
                    this.skip(wt, fn);
                }
                break;
            default:
                throw new Error("cant skip wire type " + wireType);
        }
        this.assertBounds();
        return this.buf.subarray(start, this.pos);
    }
    /**
     * Throws error if position in byte array is out of range.
     */
    assertBounds() {
        if (this.pos > this.len)
            throw new RangeError("premature EOF");
    }
    /**
     * Read a `int32` field, a signed 32 bit varint.
     */
    int32() {
        return this.uint32() | 0;
    }
    /**
     * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
     */
    sint32() {
        let zze = this.uint32();
        // decode zigzag
        return (zze >>> 1) ^ -(zze & 1);
    }
    /**
     * Read a `int64` field, a signed 64-bit varint.
     */
    int64() {
        return proto_int64_js_1.protoInt64.dec(...this.varint64());
    }
    /**
     * Read a `uint64` field, an unsigned 64-bit varint.
     */
    uint64() {
        return proto_int64_js_1.protoInt64.uDec(...this.varint64());
    }
    /**
     * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64() {
        let [lo, hi] = this.varint64();
        // decode zig zag
        let s = -(lo & 1);
        lo = ((lo >>> 1) | ((hi & 1) << 31)) ^ s;
        hi = (hi >>> 1) ^ s;
        return proto_int64_js_1.protoInt64.dec(lo, hi);
    }
    /**
     * Read a `bool` field, a variant.
     */
    bool() {
        let [lo, hi] = this.varint64();
        return lo !== 0 || hi !== 0;
    }
    /**
     * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
     */
    fixed32() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getUint32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
     */
    sfixed32() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getInt32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
     */
    fixed64() {
        return proto_int64_js_1.protoInt64.uDec(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
     */
    sfixed64() {
        return proto_int64_js_1.protoInt64.dec(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `float` field, 32-bit floating point number.
     */
    float() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getFloat32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `double` field, a 64-bit floating point number.
     */
    double() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getFloat64((this.pos += 8) - 8, true);
    }
    /**
     * Read a `bytes` field, length-delimited arbitrary data.
     */
    bytes() {
        let len = this.uint32(), start = this.pos;
        this.pos += len;
        this.assertBounds();
        return this.buf.subarray(start, start + len);
    }
    /**
     * Read a `string` field, length-delimited data converted to UTF-8 text.
     */
    string() {
        return this.decodeUtf8(this.bytes());
    }
}
exports.BinaryReader = BinaryReader;
/**
 * Assert a valid signed protobuf 32-bit integer as a number or string.
 */
function assertInt32(arg) {
    if (typeof arg == "string") {
        arg = Number(arg);
    }
    else if (typeof arg != "number") {
        throw new Error("invalid int32: " + typeof arg);
    }
    if (!Number.isInteger(arg) ||
        arg > exports.INT32_MAX ||
        arg < exports.INT32_MIN)
        throw new Error("invalid int32: " + arg);
}
/**
 * Assert a valid unsigned protobuf 32-bit integer as a number or string.
 */
function assertUInt32(arg) {
    if (typeof arg == "string") {
        arg = Number(arg);
    }
    else if (typeof arg != "number") {
        throw new Error("invalid uint32: " + typeof arg);
    }
    if (!Number.isInteger(arg) ||
        arg > exports.UINT32_MAX ||
        arg < 0)
        throw new Error("invalid uint32: " + arg);
}
/**
 * Assert a valid protobuf float value as a number or string.
 */
function assertFloat32(arg) {
    if (typeof arg == "string") {
        const o = arg;
        arg = Number(arg);
        if (Number.isNaN(arg) && o !== "NaN") {
            throw new Error("invalid float32: " + o);
        }
    }
    else if (typeof arg != "number") {
        throw new Error("invalid float32: " + typeof arg);
    }
    if (Number.isFinite(arg) &&
        (arg > exports.FLOAT32_MAX || arg < exports.FLOAT32_MIN))
        throw new Error("invalid float32: " + arg);
}
