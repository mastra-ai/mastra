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
import { BN } from '../util/bn.mjs';
import { Vector } from '../vector.mjs';
import { Visitor } from '../visitor.mjs';
import { BufferType } from '../enum.mjs';
import { UnionMode, DateUnit, TimeUnit } from '../enum.mjs';
import { BitIterator, getBit, getBool } from '../util/bit.mjs';
import { DataType, } from '../type.mjs';
/** @ignore */
export class JSONVectorAssembler extends Visitor {
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
        const type = DataType.isDictionary(data.type) ? data.type.indices : data.type;
        const buffers = Object.assign([], data.buffers, { [BufferType.VALIDITY]: undefined });
        return Object.assign({ 'name': name, 'count': length, 'VALIDITY': (DataType.isNull(type) || DataType.isUnion(type))
                ? undefined
                : nullCount <= 0 ? Array.from({ length }, () => 1)
                    : [...new BitIterator(nullBitmap, offset, length, null, getBit)] }, super.visit(data.clone(type, offset, length, 0, buffers)));
    }
    visitNull() { return {}; }
    visitBool({ values, offset, length }) {
        return { 'DATA': [...new BitIterator(values, offset, length, null, getBool)] };
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
        return { 'DATA': [...new Vector([data])], 'OFFSET': [...data.valueOffsets] };
    }
    visitLargeUtf8(data) {
        return { 'DATA': [...new Vector([data])], 'OFFSET': [...bigNumsToStrings(data.valueOffsets, 2)] };
    }
    visitBinary(data) {
        return { 'DATA': [...binaryToString(new Vector([data]))], 'OFFSET': [...data.valueOffsets] };
    }
    visitLargeBinary(data) {
        return { 'DATA': [...binaryToString(new Vector([data]))], 'OFFSET': [...bigNumsToStrings(data.valueOffsets, 2)] };
    }
    visitFixedSizeBinary(data) {
        return { 'DATA': [...binaryToString(new Vector([data]))] };
    }
    visitDate(data) {
        return {
            'DATA': data.type.unit === DateUnit.DAY
                ? [...data.values]
                : [...bigNumsToStrings(data.values, 2)]
        };
    }
    visitTimestamp(data) {
        return { 'DATA': [...bigNumsToStrings(data.values, 2)] };
    }
    visitTime(data) {
        return {
            'DATA': data.type.unit < TimeUnit.MICROSECOND
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
            'OFFSET': data.type.mode === UnionMode.Dense ? [...data.valueOffsets] : undefined,
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
        yield `${BN.new(u32s.subarray((i + 0) * stride, (i + 1) * stride), false)}`;
    }
}

//# sourceMappingURL=jsonvectorassembler.mjs.map
