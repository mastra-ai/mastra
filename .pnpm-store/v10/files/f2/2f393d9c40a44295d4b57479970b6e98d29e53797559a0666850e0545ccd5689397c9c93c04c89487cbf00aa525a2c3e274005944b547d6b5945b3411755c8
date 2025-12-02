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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { toBinary } from "../to-binary.js";
import { BinaryReader, BinaryWriter } from "./binary-encoding.js";
import { fromBinary } from "../from-binary.js";
/**
 * Serialize a message, prefixing it with its size.
 *
 * A size-delimited message is a varint size in bytes, followed by exactly
 * that many bytes of a message serialized with the binary format.
 *
 * This size-delimited format is compatible with other implementations.
 * For details, see https://github.com/protocolbuffers/protobuf/issues/10229
 */
export function sizeDelimitedEncode(messageDesc, message, options) {
    const writer = new BinaryWriter();
    writer.bytes(toBinary(messageDesc, message, options));
    return writer.finish();
}
/**
 * Parse a stream of size-delimited messages.
 *
 * A size-delimited message is a varint size in bytes, followed by exactly
 * that many bytes of a message serialized with the binary format.
 *
 * This size-delimited format is compatible with other implementations.
 * For details, see https://github.com/protocolbuffers/protobuf/issues/10229
 */
export function sizeDelimitedDecodeStream(messageDesc, iterable, options) {
    return __asyncGenerator(this, arguments, function* sizeDelimitedDecodeStream_1() {
        var _a, e_1, _b, _c;
        // append chunk to buffer, returning updated buffer
        function append(buffer, chunk) {
            const n = new Uint8Array(buffer.byteLength + chunk.byteLength);
            n.set(buffer);
            n.set(chunk, buffer.length);
            return n;
        }
        let buffer = new Uint8Array(0);
        try {
            for (var _d = true, iterable_1 = __asyncValues(iterable), iterable_1_1; iterable_1_1 = yield __await(iterable_1.next()), _a = iterable_1_1.done, !_a; _d = true) {
                _c = iterable_1_1.value;
                _d = false;
                const chunk = _c;
                buffer = append(buffer, chunk);
                for (;;) {
                    const size = sizeDelimitedPeek(buffer);
                    if (size.eof) {
                        // size is incomplete, buffer more data
                        break;
                    }
                    if (size.offset + size.size > buffer.byteLength) {
                        // message is incomplete, buffer more data
                        break;
                    }
                    yield yield __await(fromBinary(messageDesc, buffer.subarray(size.offset, size.offset + size.size), options));
                    buffer = buffer.subarray(size.offset + size.size);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = iterable_1.return)) yield __await(_b.call(iterable_1));
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (buffer.byteLength > 0) {
            throw new Error("incomplete data");
        }
    });
}
/**
 * Decodes the size from the given size-delimited message, which may be
 * incomplete.
 *
 * Returns an object with the following properties:
 * - size: The size of the delimited message in bytes
 * - offset: The offset in the given byte array where the message starts
 * - eof: true
 *
 * If the size-delimited data does not include all bytes of the varint size,
 * the following object is returned:
 * - size: null
 * - offset: null
 * - eof: false
 *
 * This function can be used to implement parsing of size-delimited messages
 * from a stream.
 */
export function sizeDelimitedPeek(data) {
    const sizeEof = { eof: true, size: null, offset: null };
    for (let i = 0; i < 10; i++) {
        if (i > data.byteLength) {
            return sizeEof;
        }
        if ((data[i] & 0x80) == 0) {
            const reader = new BinaryReader(data);
            let size;
            try {
                size = reader.uint32();
            }
            catch (e) {
                if (e instanceof RangeError) {
                    return sizeEof;
                }
                throw e;
            }
            return {
                eof: false,
                size,
                offset: reader.pos,
            };
        }
    }
    throw new Error("invalid varint");
}
