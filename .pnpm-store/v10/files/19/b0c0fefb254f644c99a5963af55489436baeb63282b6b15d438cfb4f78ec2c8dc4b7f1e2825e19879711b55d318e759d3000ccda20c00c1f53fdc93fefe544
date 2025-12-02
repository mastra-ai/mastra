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
exports.JSONVectorAssembler = void 0;
const bn_js_1 = require("../util/bn.js");
const vector_js_1 = require("../vector.js");
const visitor_js_1 = require("../visitor.js");
const enum_js_1 = require("../enum.js");
const enum_js_2 = require("../enum.js");
const bit_js_1 = require("../util/bit.js");
const type_js_1 = require("../type.js");
/** @ignore */
class JSONVectorAssembler extends visitor_js_1.Visitor {
    /** @nocollapse */
    static assemble(...batches) {
        const assembler = new JSONVectorAssembler();
        return batches.map(({ schema, data }) => {
            return assembler.visitMany(schema.fields, data.children);
        });
    }
    visit({ name }, data) {
        const { length } = data;
        const { offset, nullCount, nullBitmap } = data;
        const type = type_js_1.DataType.isDictionary(data.type) ? data.type.indices : data.type;
        const buffers = Object.assign([], data.buffers, { [enum_js_1.BufferType.VALIDITY]: undefined });
        return Object.assign({ 'name': name, 'count': length, 'VALIDITY': (type_js_1.DataType.isNull(type) || type_js_1.DataType.isUnion(type))
                ? undefined
                : nullCount <= 0 ? Array.from({ length }, () => 1)
                    : [...new bit_js_1.BitIterator(nullBitmap, offset, length, null, bit_js_1.getBit)] }, super.visit(data.clone(type, offset, length, 0, buffers)));
    }
    visitNull() { return {}; }
    visitBool({ values, offset, length }) {
        return { 'DATA': [...new bit_js_1.BitIterator(values, offset, length, null, bit_js_1.getBool)] };
    }
    visitInt(data) {
        return {
            'DATA': data.type.bitWidth < 64
                ? [...data.values]
                : [...bigNumsToStrings(data.values, 2)]
        };
    }
    visitFloat(data) {
        return { 'DATA': [...data.values] };
    }
    visitUtf8(data) {
        return { 'DATA': [...new vector_js_1.Vector([data])], 'OFFSET': [...data.valueOffsets] };
    }
    visitLargeUtf8(data) {
        return { 'DATA': [...new vector_js_1.Vector([data])], 'OFFSET': [...bigNumsToStrings(data.valueOffsets, 2)] };
    }
    visitBinary(data) {
        return { 'DATA': [...binaryToString(new vector_js_1.Vector([data]))], 'OFFSET': [...data.valueOffsets] };
    }
    visitLargeBinary(data) {
        return { 'DATA': [...binaryToString(new vector_js_1.Vector([data]))], 'OFFSET': [...bigNumsToStrings(data.valueOffsets, 2)] };
    }
    visitFixedSizeBinary(data) {
        return { 'DATA': [...binaryToString(new vector_js_1.Vector([data]))] };
    }
    visitDate(data) {
        return {
            'DATA': data.type.unit === enum_js_2.DateUnit.DAY
                ? [...data.values]
                : [...bigNumsToStrings(data.values, 2)]
        };
    }
    visitTimestamp(data) {
        return { 'DATA': [...bigNumsToStrings(data.values, 2)] };
    }
    visitTime(data) {
        return {
            'DATA': data.type.unit < enum_js_2.TimeUnit.MICROSECOND
                ? [...data.values]
                : [...bigNumsToStrings(data.values, 2)]
        };
    }
    visitDecimal(data) {
        return { 'DATA': [...bigNumsToStrings(data.values, 4)] };
    }
    visitList(data) {
        return {
            'OFFSET': [...data.valueOffsets],
            'children': this.visitMany(data.type.children, data.children)
        };
    }
    visitStruct(data) {
        return {
            'children': this.visitMany(data.type.children, data.children)
        };
    }
    visitUnion(data) {
        return {
            'TYPE_ID': [...data.typeIds],
            'OFFSET': data.type.mode === enum_js_2.UnionMode.Dense ? [...data.valueOffsets] : undefined,
            'children': this.visitMany(data.type.children, data.children)
        };
    }
    visitInterval(data) {
        return { 'DATA': [...data.values] };
    }
    visitDuration(data) {
        return { 'DATA': [...bigNumsToStrings(data.values, 2)] };
    }
    visitFixedSizeList(data) {
        return {
            'children': this.visitMany(data.type.children, data.children)
        };
    }
    visitMap(data) {
        return {
            'OFFSET': [...data.valueOffsets],
            'children': this.visitMany(data.type.children, data.children)
        };
    }
}
exports.JSONVectorAssembler = JSONVectorAssembler;
/** @ignore */
function* binaryToString(vector) {
    for (const octets of vector) {
        yield octets.reduce((str, byte) => {
            return `${str}${('0' + (byte & 0xFF).toString(16)).slice(-2)}`;
        }, '').toUpperCase();
    }
}
/** @ignore */
function* bigNumsToStrings(values, stride) {
    const u32s = new Uint32Array(values.buffer);
    for (let i = -1, n = u32s.length / stride; ++i < n;) {
        yield `${bn_js_1.BN.new(u32s.subarray((i + 0) * stride, (i + 1) * stride), false)}`;
    }
}

//# sourceMappingURL=jsonvectorassembler.js.map
