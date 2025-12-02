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
exports.makeData = exports.Data = exports.kUnknownNullCount = void 0;
const vector_js_1 = require("./vector.js");
const enum_js_1 = require("./enum.js");
const type_js_1 = require("./type.js");
const bit_js_1 = require("./util/bit.js");
/** @ignore */ exports.kUnknownNullCount = -1;
/**
 * Data structure underlying {@link Vector}s. Use the convenience method {@link makeData}.
 */
class Data {
    get typeId() { return this.type.typeId; }
    get ArrayType() { return this.type.ArrayType; }
    get buffers() {
        return [this.valueOffsets, this.values, this.nullBitmap, this.typeIds];
    }
    get nullable() {
        if (this._nullCount !== 0) {
            const { type } = this;
            if (type_js_1.DataType.isSparseUnion(type)) {
                return this.children.some((child) => child.nullable);
            }
            else if (type_js_1.DataType.isDenseUnion(type)) {
                return this.children.some((child) => child.nullable);
            }
            return this.nullBitmap && this.nullBitmap.byteLength > 0;
        }
        return true;
    }
    get byteLength() {
        let byteLength = 0;
        const { valueOffsets, values, nullBitmap, typeIds } = this;
        valueOffsets && (byteLength += valueOffsets.byteLength);
        values && (byteLength += values.byteLength);
        nullBitmap && (byteLength += nullBitmap.byteLength);
        typeIds && (byteLength += typeIds.byteLength);
        return this.children.reduce((byteLength, child) => byteLength + child.byteLength, byteLength);
    }
    get nullCount() {
        if (type_js_1.DataType.isUnion(this.type)) {
            return this.children.reduce((nullCount, child) => nullCount + child.nullCount, 0);
        }
        let nullCount = this._nullCount;
        let nullBitmap;
        if (nullCount <= exports.kUnknownNullCount && (nullBitmap = this.nullBitmap)) {
            this._nullCount = nullCount = nullBitmap.length === 0 ?
                // no null bitmap, so all values are valid
                0 :
                this.length - (0, bit_js_1.popcnt_bit_range)(nullBitmap, this.offset, this.offset + this.length);
        }
        return nullCount;
    }
    constructor(type, offset, length, nullCount, buffers, children = [], dictionary) {
        this.type = type;
        this.children = children;
        this.dictionary = dictionary;
        this.offset = Math.floor(Math.max(offset || 0, 0));
        this.length = Math.floor(Math.max(length || 0, 0));
        this._nullCount = Math.floor(Math.max(nullCount || 0, -1));
        let buffer;
        if (buffers instanceof Data) {
            this.stride = buffers.stride;
            this.values = buffers.values;
            this.typeIds = buffers.typeIds;
            this.nullBitmap = buffers.nullBitmap;
            this.valueOffsets = buffers.valueOffsets;
        }
        else {
            this.stride = (0, type_js_1.strideForType)(type);
            if (buffers) {
                (buffer = buffers[0]) && (this.valueOffsets = buffer);
                (buffer = buffers[1]) && (this.values = buffer);
                (buffer = buffers[2]) && (this.nullBitmap = buffer);
                (buffer = buffers[3]) && (this.typeIds = buffer);
            }
        }
    }
    getValid(index) {
        const { type } = this;
        if (type_js_1.DataType.isUnion(type)) {
            const union = type;
            const child = this.children[union.typeIdToChildIndex[this.typeIds[index]]];
            const indexInChild = union.mode === enum_js_1.UnionMode.Dense ? this.valueOffsets[index] : index;
            return child.getValid(indexInChild);
        }
        if (this.nullable && this.nullCount > 0) {
            const pos = this.offset + index;
            const val = this.nullBitmap[pos >> 3];
            return (val & (1 << (pos % 8))) !== 0;
        }
        return true;
    }
    setValid(index, value) {
        let prev;
        const { type } = this;
        if (type_js_1.DataType.isUnion(type)) {
            const union = type;
            const child = this.children[union.typeIdToChildIndex[this.typeIds[index]]];
            const indexInChild = union.mode === enum_js_1.UnionMode.Dense ? this.valueOffsets[index] : index;
            prev = child.getValid(indexInChild);
            child.setValid(indexInChild, value);
        }
        else {
            let { nullBitmap } = this;
            const { offset, length } = this;
            const idx = offset + index;
            const mask = 1 << (idx % 8);
            const byteOffset = idx >> 3;
            // If no null bitmap, initialize one on the fly
            if (!nullBitmap || nullBitmap.byteLength <= byteOffset) {
                nullBitmap = new Uint8Array((((offset + length) + 63) & ~63) >> 3).fill(255);
                // if we have a nullBitmap, truncate + slice and set it over the pre-filled 1s
                if (this.nullCount > 0) {
                    nullBitmap.set((0, bit_js_1.truncateBitmap)(offset, length, this.nullBitmap), 0);
                    Object.assign(this, { nullBitmap });
                }
                else {
                    Object.assign(this, { nullBitmap, _nullCount: 0 });
                }
            }
            const byte = nullBitmap[byteOffset];
            prev = (byte & mask) !== 0;
            nullBitmap[byteOffset] = value ? (byte | mask) : (byte & ~mask);
        }
        if (prev !== !!value) {
            // Update `_nullCount` if the new value is different from the old value.
            this._nullCount = this.nullCount + (value ? -1 : 1);
        }
        return value;
    }
    clone(type = this.type, offset = this.offset, length = this.length, nullCount = this._nullCount, buffers = this, children = this.children) {
        return new Data(type, offset, length, nullCount, buffers, children, this.dictionary);
    }
    slice(offset, length) {
        const { stride, typeId, children } = this;
        // +true === 1, +false === 0, so this means
        // we keep nullCount at 0 if it's already 0,
        // otherwise set to the invalidated flag -1
        const nullCount = +(this._nullCount === 0) - 1;
        const childStride = typeId === 16 /* FixedSizeList */ ? stride : 1;
        const buffers = this._sliceBuffers(offset, length, stride, typeId);
        return this.clone(this.type, this.offset + offset, length, nullCount, buffers, 
        // Don't slice children if we have value offsets (the variable-width types)
        (children.length === 0 || this.valueOffsets) ? children : this._sliceChildren(children, childStride * offset, childStride * length));
    }
    _changeLengthAndBackfillNullBitmap(newLength) {
        if (this.typeId === enum_js_1.Type.Null) {
            return this.clone(this.type, 0, newLength, 0);
        }
        const { length, nullCount } = this;
        // start initialized with 0s (nulls), then fill from 0 to length with 1s (not null)
        const bitmap = new Uint8Array(((newLength + 63) & ~63) >> 3).fill(255, 0, length >> 3);
        // set all the bits in the last byte (up to bit `length - length % 8`) to 1 (not null)
        bitmap[length >> 3] = (1 << (length - (length & ~7))) - 1;
        // if we have a nullBitmap, truncate + slice and set it over the pre-filled 1s
        if (nullCount > 0) {
            bitmap.set((0, bit_js_1.truncateBitmap)(this.offset, length, this.nullBitmap), 0);
        }
        const buffers = this.buffers;
        buffers[enum_js_1.BufferType.VALIDITY] = bitmap;
        return this.clone(this.type, 0, newLength, nullCount + (newLength - length), buffers);
    }
    _sliceBuffers(offset, length, stride, typeId) {
        let arr;
        const { buffers } = this;
        // If typeIds exist, slice the typeIds buffer
        (arr = buffers[enum_js_1.BufferType.TYPE]) && (buffers[enum_js_1.BufferType.TYPE] = arr.subarray(offset, offset + length));
        // If offsets exist, only slice the offsets buffer
        (arr = buffers[enum_js_1.BufferType.OFFSET]) && (buffers[enum_js_1.BufferType.OFFSET] = arr.subarray(offset, offset + length + 1)) ||
            // Otherwise if no offsets, slice the data buffer. Don't slice the data vector for Booleans, since the offset goes by bits not bytes
            (arr = buffers[enum_js_1.BufferType.DATA]) && (buffers[enum_js_1.BufferType.DATA] = typeId === 6 ? arr : arr.subarray(stride * offset, stride * (offset + length)));
        return buffers;
    }
    _sliceChildren(children, offset, length) {
        return children.map((child) => child.slice(offset, length));
    }
}
exports.Data = Data;
Data.prototype.children = Object.freeze([]);
const visitor_js_1 = require("./visitor.js");
const buffer_js_1 = require("./util/buffer.js");
class MakeDataVisitor extends visitor_js_1.Visitor {
    visit(props) {
        return this.getVisitFn(props['type']).call(this, props);
    }
    visitNull(props) {
        const { ['type']: type, ['offset']: offset = 0, ['length']: length = 0, } = props;
        return new Data(type, offset, length, length);
    }
    visitBool(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length >> 3, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitInt(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitFloat(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitUtf8(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = (0, buffer_js_1.toUint8Array)(props['data']);
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toInt32Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    visitLargeUtf8(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = (0, buffer_js_1.toUint8Array)(props['data']);
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toBigInt64Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    visitBinary(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = (0, buffer_js_1.toUint8Array)(props['data']);
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toInt32Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    visitLargeBinary(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = (0, buffer_js_1.toUint8Array)(props['data']);
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toBigInt64Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    visitFixedSizeBinary(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitDate(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitTimestamp(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitTime(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitDecimal(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitList(props) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toInt32Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, nullBitmap], [child]);
    }
    visitStruct(props) {
        const { ['type']: type, ['offset']: offset = 0, ['children']: children = [] } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const { length = children.reduce((len, { length }) => Math.max(len, length), 0), nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [undefined, undefined, nullBitmap], children);
    }
    visitUnion(props) {
        const { ['type']: type, ['offset']: offset = 0, ['children']: children = [] } = props;
        const typeIds = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['typeIds']);
        const { ['length']: length = typeIds.length, ['nullCount']: nullCount = -1, } = props;
        if (type_js_1.DataType.isSparseUnion(type)) {
            return new Data(type, offset, length, nullCount, [undefined, undefined, undefined, typeIds], children);
        }
        const valueOffsets = (0, buffer_js_1.toInt32Array)(props['valueOffsets']);
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, undefined, typeIds], children);
    }
    visitDictionary(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.indices.ArrayType, props['data']);
        const { ['dictionary']: dictionary = new vector_js_1.Vector([new MakeDataVisitor().visit({ type: type.dictionary })]) } = props;
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap], [], dictionary);
    }
    visitInterval(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitDuration(props) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const data = (0, buffer_js_1.toArrayBufferView)(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    visitFixedSizeList(props) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child = new MakeDataVisitor().visit({ type: type.valueType }) } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const { ['length']: length = child.length / (0, type_js_1.strideForType)(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [undefined, undefined, nullBitmap], [child]);
    }
    visitMap(props) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child = new MakeDataVisitor().visit({ type: type.childType }) } = props;
        const nullBitmap = (0, buffer_js_1.toUint8Array)(props['nullBitmap']);
        const valueOffsets = (0, buffer_js_1.toInt32Array)(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, nullBitmap], [child]);
    }
}
const makeDataVisitor = new MakeDataVisitor();
function makeData(props) {
    return makeDataVisitor.visit(props);
}
exports.makeData = makeData;

//# sourceMappingURL=data.js.map
