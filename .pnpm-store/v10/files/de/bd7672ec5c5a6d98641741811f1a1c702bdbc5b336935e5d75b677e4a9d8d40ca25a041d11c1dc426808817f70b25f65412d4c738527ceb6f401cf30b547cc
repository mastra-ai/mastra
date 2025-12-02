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
exports.VectorAssembler = void 0;
const vector_js_1 = require("../vector.js");
const visitor_js_1 = require("../visitor.js");
const enum_js_1 = require("../enum.js");
const recordbatch_js_1 = require("../recordbatch.js");
const buffer_js_1 = require("../util/buffer.js");
const bit_js_1 = require("../util/bit.js");
const message_js_1 = require("../ipc/metadata/message.js");
const type_js_1 = require("../type.js");
const bigint_js_1 = require("../util/bigint.js");
/** @ignore */
class VectorAssembler extends visitor_js_1.Visitor {
    /** @nocollapse */
    static assemble(...args) {
        const unwrap = (nodes) => nodes.flatMap((node) => Array.isArray(node) ? unwrap(node) :
            (node instanceof recordbatch_js_1.RecordBatch) ? node.data.children : node.data);
        const assembler = new VectorAssembler();
        assembler.visitMany(unwrap(args));
        return assembler;
    }
    constructor() {
        super();
        this._byteLength = 0;
        this._nodes = [];
        this._buffers = [];
        this._bufferRegions = [];
    }
    visit(data) {
        if (data instanceof vector_js_1.Vector) {
            this.visitMany(data.data);
            return this;
        }
        const { type } = data;
        if (!type_js_1.DataType.isDictionary(type)) {
            const { length } = data;
            if (length > 2147483647) {
                /* istanbul ignore next */
                throw new RangeError('Cannot write arrays larger than 2^31 - 1 in length');
            }
            if (type_js_1.DataType.isUnion(type)) {
                this.nodes.push(new message_js_1.FieldNode(length, 0));
            }
            else {
                const { nullCount } = data;
                if (!type_js_1.DataType.isNull(type)) {
                    addBuffer.call(this, nullCount <= 0
                        ? new Uint8Array(0) // placeholder validity buffer
                        : (0, bit_js_1.truncateBitmap)(data.offset, length, data.nullBitmap));
                }
                this.nodes.push(new message_js_1.FieldNode(length, nullCount));
            }
        }
        return super.visit(data);
    }
    visitNull(_null) {
        return this;
    }
    visitDictionary(data) {
        // Assemble the indices here, Dictionary assembled separately.
        return this.visit(data.clone(data.type.indices));
    }
    get nodes() { return this._nodes; }
    get buffers() { return this._buffers; }
    get byteLength() { return this._byteLength; }
    get bufferRegions() { return this._bufferRegions; }
}
exports.VectorAssembler = VectorAssembler;
/** @ignore */
function addBuffer(values) {
    const byteLength = (values.byteLength + 7) & ~7; // Round up to a multiple of 8
    this.buffers.push(values);
    this.bufferRegions.push(new message_js_1.BufferRegion(this._byteLength, byteLength));
    this._byteLength += byteLength;
    return this;
}
/** @ignore */
function assembleUnion(data) {
    var _a;
    const { type, length, typeIds, valueOffsets } = data;
    // All Union Vectors have a typeIds buffer
    addBuffer.call(this, typeIds);
    // If this is a Sparse Union, treat it like all other Nested types
    if (type.mode === enum_js_1.UnionMode.Sparse) {
        return assembleNestedVector.call(this, data);
    }
    else if (type.mode === enum_js_1.UnionMode.Dense) {
        // If this is a Dense Union, add the valueOffsets buffer and potentially slice the children
        if (data.offset <= 0) {
            // If the Vector hasn't been sliced, write the existing valueOffsets
            addBuffer.call(this, valueOffsets);
            // We can treat this like all other Nested types
            return assembleNestedVector.call(this, data);
        }
        else {
            // A sliced Dense Union is an unpleasant case. Because the offsets are different for
            // each child vector, we need to "rebase" the valueOffsets for each child
            // Union typeIds are not necessary 0-indexed
            const shiftedOffsets = new Int32Array(length);
            const childOffsets = Object.create(null);
            const childLengths = Object.create(null);
            // If we have a non-zero offset, then the value offsets do not start at
            // zero. We must a) create a new offsets array with shifted offsets and
            // b) slice the values array accordingly
            for (let typeId, shift, index = -1; ++index < length;) {
                if ((typeId = typeIds[index]) === undefined) {
                    continue;
                }
                if ((shift = childOffsets[typeId]) === undefined) {
                    shift = childOffsets[typeId] = valueOffsets[index];
                }
                shiftedOffsets[index] = valueOffsets[index] - shift;
                childLengths[typeId] = ((_a = childLengths[typeId]) !== null && _a !== void 0 ? _a : 0) + 1;
            }
            addBuffer.call(this, shiftedOffsets);
            // Slice and visit children accordingly
            this.visitMany(data.children.map((child, childIndex) => {
                const typeId = type.typeIds[childIndex];
                const childOffset = childOffsets[typeId];
                const childLength = childLengths[typeId];
                return child.slice(childOffset, Math.min(length, childLength));
            }));
        }
    }
    return this;
}
/** @ignore */
function assembleBoolVector(data) {
    // Bool vector is a special case of FlatVector, as its data buffer needs to stay packed
    let values;
    if (data.nullCount >= data.length) {
        // If all values are null, just insert a placeholder empty data buffer (fastest path)
        return addBuffer.call(this, new Uint8Array(0));
    }
    else if ((values = data.values) instanceof Uint8Array) {
        // If values is already a Uint8Array, slice the bitmap (fast path)
        return addBuffer.call(this, (0, bit_js_1.truncateBitmap)(data.offset, data.length, values));
    }
    // Otherwise if the underlying data *isn't* a Uint8Array, enumerate the
    // values as bools and re-pack them into a Uint8Array. This code isn't
    // reachable unless you're trying to manipulate the Data internals,
    // we're only doing this for safety.
    /* istanbul ignore next */
    return addBuffer.call(this, (0, bit_js_1.packBools)(data.values));
}
/** @ignore */
function assembleFlatVector(data) {
    return addBuffer.call(this, data.values.subarray(0, data.length * data.stride));
}
/** @ignore */
function assembleFlatListVector(data) {
    const { length, values, valueOffsets } = data;
    const begin = (0, bigint_js_1.bigIntToNumber)(valueOffsets[0]);
    const end = (0, bigint_js_1.bigIntToNumber)(valueOffsets[length]);
    const byteLength = Math.min(end - begin, values.byteLength - begin);
    // Push in the order FlatList types read their buffers
    addBuffer.call(this, (0, buffer_js_1.rebaseValueOffsets)(-begin, length + 1, valueOffsets)); // valueOffsets buffer first
    addBuffer.call(this, values.subarray(begin, begin + byteLength)); // sliced values buffer second
    return this;
}
/** @ignore */
function assembleListVector(data) {
    const { length, valueOffsets } = data;
    // If we have valueOffsets (MapVector, ListVector), push that buffer first
    if (valueOffsets) {
        const { [0]: begin, [length]: end } = valueOffsets;
        addBuffer.call(this, (0, buffer_js_1.rebaseValueOffsets)(-begin, length + 1, valueOffsets));
        // Then insert the List's values child
        return this.visit(data.children[0].slice(begin, end - begin));
    }
    // Then insert the List's values child
    return this.visit(data.children[0]);
}
/** @ignore */
function assembleNestedVector(data) {
    return this.visitMany(data.type.children.map((_, i) => data.children[i]).filter(Boolean))[0];
}
VectorAssembler.prototype.visitBool = assembleBoolVector;
VectorAssembler.prototype.visitInt = assembleFlatVector;
VectorAssembler.prototype.visitFloat = assembleFlatVector;
VectorAssembler.prototype.visitUtf8 = assembleFlatListVector;
VectorAssembler.prototype.visitLargeUtf8 = assembleFlatListVector;
VectorAssembler.prototype.visitBinary = assembleFlatListVector;
VectorAssembler.prototype.visitLargeBinary = assembleFlatListVector;
VectorAssembler.prototype.visitFixedSizeBinary = assembleFlatVector;
VectorAssembler.prototype.visitDate = assembleFlatVector;
VectorAssembler.prototype.visitTimestamp = assembleFlatVector;
VectorAssembler.prototype.visitTime = assembleFlatVector;
VectorAssembler.prototype.visitDecimal = assembleFlatVector;
VectorAssembler.prototype.visitList = assembleListVector;
VectorAssembler.prototype.visitStruct = assembleNestedVector;
VectorAssembler.prototype.visitUnion = assembleUnion;
VectorAssembler.prototype.visitInterval = assembleFlatVector;
VectorAssembler.prototype.visitDuration = assembleFlatVector;
VectorAssembler.prototype.visitFixedSizeList = assembleListVector;
VectorAssembler.prototype.visitMap = assembleListVector;

//# sourceMappingURL=vectorassembler.js.map
