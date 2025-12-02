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

import { Data } from '../data.js';
import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { Type, UnionMode } from '../enum.js';
import { RecordBatch } from '../recordbatch.js';
import { TypeToDataType } from '../interfaces.js';
import { rebaseValueOffsets } from '../util/buffer.js';
import { packBools, truncateBitmap } from '../util/bit.js';
import { BufferRegion, FieldNode } from '../ipc/metadata/message.js';
import {
    DataType, Dictionary,
    Float, Int, Date_, Interval, Time, Timestamp, Union, Duration,
    Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct,
} from '../type.js';
import { bigIntToNumber } from '../util/bigint.js';

/** @ignore */
export interface VectorAssembler extends Visitor {
    visit<T extends DataType>(node: Vector<T> | Data<T>): this;
    visitMany<T extends DataType>(nodes: readonly Data<T>[]): this[];
    getVisitFn<T extends Type>(node: T): (data: Data<TypeToDataType<T>>) => this;
    getVisitFn<T extends DataType>(node: Vector<T> | Data<T> | T): (data: Data<T>) => this;

    visitBool<T extends Bool>(data: Data<T>): this;
    visitInt<T extends Int>(data: Data<T>): this;
    visitFloat<T extends Float>(data: Data<T>): this;
    visitUtf8<T extends Utf8>(data: Data<T>): this;
    visitLargeUtf8<T extends LargeUtf8>(data: Data<T>): this;
    visitBinary<T extends Binary>(data: Data<T>): this;
    visitLargeBinary<T extends LargeBinary>(data: Data<T>): this;
    visitFixedSizeBinary<T extends FixedSizeBinary>(data: Data<T>): this;
    visitDate<T extends Date_>(data: Data<T>): this;
    visitTimestamp<T extends Timestamp>(data: Data<T>): this;
    visitTime<T extends Time>(data: Data<T>): this;
    visitDecimal<T extends Decimal>(data: Data<T>): this;
    visitList<T extends List>(data: Data<T>): this;
    visitStruct<T extends Struct>(data: Data<T>): this;
    visitUnion<T extends Union>(data: Data<T>): this;
    visitInterval<T extends Interval>(data: Data<T>): this;
    visitDuration<T extends Duration>(data: Data<T>): this;
    visitFixedSizeList<T extends FixedSizeList>(data: Data<T>): this;
    visitMap<T extends Map_>(data: Data<T>): this;
}

/** @ignore */
export class VectorAssembler extends Visitor {

    /** @nocollapse */
    public static assemble<T extends Vector | RecordBatch>(...args: (T | T[])[]) {
        const unwrap = (nodes: (T | T[])[]): Data[] =>
            nodes.flatMap((node: T | T[]) => Array.isArray(node) ? unwrap(node) :
                (node instanceof RecordBatch) ? node.data.children : node.data);
        const assembler = new VectorAssembler();
        assembler.visitMany(unwrap(args));
        return assembler;
    }

    private constructor() { super(); }

    public visit<T extends DataType>(data: Vector<T> | Data<T>): this {
        if (data instanceof Vector) {
            this.visitMany(data.data);
            return this;
        }
        const { type } = data;
        if (!DataType.isDictionary(type)) {
            const { length } = data;
            if (length > 2147483647) {
                /* istanbul ignore next */
                throw new RangeError('Cannot write arrays larger than 2^31 - 1 in length');
            }
            if (DataType.isUnion(type)) {
                this.nodes.push(new FieldNode(length, 0));
            } else {
                const { nullCount } = data;
                if (!DataType.isNull(type)) {
                    addBuffer.call(this, nullCount <= 0
                        ? new Uint8Array(0) // placeholder validity buffer
                        : truncateBitmap(data.offset, length, data.nullBitmap)
                    );
                }
                this.nodes.push(new FieldNode(length, nullCount));
            }
        }
        return super.visit(data);
    }

    public visitNull<T extends Null>(_null: Data<T>) {
        return this;
    }

    public visitDictionary<T extends Dictionary>(data: Data<T>) {
        // Assemble the indices here, Dictionary assembled separately.
        return this.visit(data.clone(data.type.indices));
    }

    public get nodes() { return this._nodes; }
    public get buffers() { return this._buffers; }
    public get byteLength() { return this._byteLength; }
    public get bufferRegions() { return this._bufferRegions; }

    protected _byteLength = 0;
    protected _nodes: FieldNode[] = [];
    protected _buffers: ArrayBufferView[] = [];
    protected _bufferRegions: BufferRegion[] = [];
}

/** @ignore */
function addBuffer(this: VectorAssembler, values: ArrayBufferView) {
    const byteLength = (values.byteLength + 7) & ~7; // Round up to a multiple of 8
    this.buffers.push(values);
    this.bufferRegions.push(new BufferRegion(this._byteLength, byteLength));
    this._byteLength += byteLength;
    return this;
}

/** @ignore */
function assembleUnion<T extends Union>(this: VectorAssembler, data: Data<T>) {
    const { type, length, typeIds, valueOffsets } = data;
    // All Union Vectors have a typeIds buffer
    addBuffer.call(this, typeIds);
    // If this is a Sparse Union, treat it like all other Nested types
    if (type.mode === UnionMode.Sparse) {
        return assembleNestedVector.call(this, data);
    } else if (type.mode === UnionMode.Dense) {
        // If this is a Dense Union, add the valueOffsets buffer and potentially slice the children
        if (data.offset <= 0) {
            // If the Vector hasn't been sliced, write the existing valueOffsets
            addBuffer.call(this, valueOffsets);
            // We can treat this like all other Nested types
            return assembleNestedVector.call(this, data);
        } else {
            // A sliced Dense Union is an unpleasant case. Because the offsets are different for
            // each child vector, we need to "rebase" the valueOffsets for each child
            // Union typeIds are not necessary 0-indexed
            const shiftedOffsets = new Int32Array(length);
            const childOffsets = Object.create(null) as Record<string, number>;
            const childLengths = Object.create(null) as Record<string, number>;
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
                childLengths[typeId] = (childLengths[typeId] ?? 0) + 1;
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
function assembleBoolVector<T extends Bool>(this: VectorAssembler, data: Data<T>) {
    // Bool vector is a special case of FlatVector, as its data buffer needs to stay packed
    let values: Uint8Array;
    if (data.nullCount >= data.length) {
        // If all values are null, just insert a placeholder empty data buffer (fastest path)
        return addBuffer.call(this, new Uint8Array(0));
    } else if ((values = data.values) instanceof Uint8Array) {
        // If values is already a Uint8Array, slice the bitmap (fast path)
        return addBuffer.call(this, truncateBitmap(data.offset, data.length, values));
    }
    // Otherwise if the underlying data *isn't* a Uint8Array, enumerate the
    // values as bools and re-pack them into a Uint8Array. This code isn't
    // reachable unless you're trying to manipulate the Data internals,
    // we're only doing this for safety.
    /* istanbul ignore next */
    return addBuffer.call(this, packBools(data.values));
}

/** @ignore */
function assembleFlatVector<T extends Int | Float | FixedSizeBinary | Date_ | Timestamp | Time | Decimal | Interval | Duration>(this: VectorAssembler, data: Data<T>) {
    return addBuffer.call(this, data.values.subarray(0, data.length * data.stride));
}

/** @ignore */
function assembleFlatListVector<T extends Utf8 | LargeUtf8 | Binary | LargeBinary>(this: VectorAssembler, data: Data<T>) {
    const { length, values, valueOffsets } = data;
    const begin = bigIntToNumber(valueOffsets[0]);
    const end = bigIntToNumber(valueOffsets[length]);
    const byteLength = Math.min(end - begin, values.byteLength - begin);
    // Push in the order FlatList types read their buffers
    addBuffer.call(this, rebaseValueOffsets(-begin, length + 1, valueOffsets as any)); // valueOffsets buffer first
    addBuffer.call(this, values.subarray(begin, begin + byteLength)); // sliced values buffer second
    return this;
}

/** @ignore */
function assembleListVector<T extends Map_ | List | FixedSizeList>(this: VectorAssembler, data: Data<T>) {
    const { length, valueOffsets } = data;
    // If we have valueOffsets (MapVector, ListVector), push that buffer first
    if (valueOffsets) {
        const { [0]: begin, [length]: end } = valueOffsets;
        addBuffer.call(this, rebaseValueOffsets(-begin, length + 1, valueOffsets));
        // Then insert the List's values child
        return this.visit(data.children[0].slice(begin, end - begin));
    }
    // Then insert the List's values child
    return this.visit(data.children[0]);
}

/** @ignore */
function assembleNestedVector<T extends Struct | Union>(this: VectorAssembler, data: Data<T>) {
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
