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

import { Vector } from './vector.js';
import { BufferType, Type, UnionMode } from './enum.js';
import { DataType, strideForType } from './type.js';
import { popcnt_bit_range, truncateBitmap } from './util/bit.js';

// When slicing, we do not know the null count of the sliced range without
// doing some computation. To avoid doing this eagerly, we set the null count
// to -1 (any negative number will do). When Vector.nullCount is called the
// first time, the null count will be computed. See ARROW-33
/** @ignore */ export type kUnknownNullCount = -1;
/** @ignore */ export const kUnknownNullCount = -1;

/** @ignore */ export type NullBuffer = Uint8Array | null | undefined;
/** @ignore */ export type TypeIdsBuffer = Int8Array | ArrayLike<number> | Iterable<number> | undefined;
/** @ignore */ export type ValueOffsetsBuffer = Int32Array | ArrayLike<number> | Iterable<number> | undefined;
/** @ignore */ export type LargeValueOffsetsBuffer = BigInt64Array | ArrayLike<bigint> | Iterable<bigint> | undefined;
/** @ignore */ export type DataBuffer<T extends DataType> = T['TArray'] | ArrayLike<number> | Iterable<number> | undefined;

/** @ignore */
export interface Buffers<T extends DataType> {
    [BufferType.OFFSET]: T['TOffsetArray'];
    [BufferType.DATA]: T['TArray'];
    [BufferType.VALIDITY]: Uint8Array;
    [BufferType.TYPE]: T['TArray'];
}

/** @ignore */
export interface Data<T extends DataType = DataType> {
    readonly TType: T['TType'];
    readonly TArray: T['TArray'];
    readonly TValue: T['TValue'];
}

/**
 * Data structure underlying {@link Vector}s. Use the convenience method {@link makeData}.
 */
export class Data<T extends DataType = DataType> {

    declare public readonly type: T;
    declare public readonly length: number;
    declare public readonly offset: number;
    declare public readonly stride: number;
    declare public readonly children: Data[];

    /**
     * The dictionary for this Vector, if any. Only used for Dictionary type.
     */
    declare public dictionary?: Vector;

    declare public readonly values: Buffers<T>[BufferType.DATA];
    declare public readonly typeIds: Buffers<T>[BufferType.TYPE];
    declare public readonly nullBitmap: Buffers<T>[BufferType.VALIDITY];
    declare public readonly valueOffsets: Buffers<T>[BufferType.OFFSET];

    public get typeId(): T['TType'] { return this.type.typeId; }

    public get ArrayType(): T['ArrayType'] { return this.type.ArrayType; }

    public get buffers() {
        return [this.valueOffsets, this.values, this.nullBitmap, this.typeIds] as Buffers<T>;
    }

    public get nullable(): boolean {
        if (this._nullCount !== 0) {
            const { type } = this;
            if (DataType.isSparseUnion(type)) {
                return this.children.some((child) => child.nullable);
            } else if (DataType.isDenseUnion(type)) {
                return this.children.some((child) => child.nullable);
            }
            return this.nullBitmap && this.nullBitmap.byteLength > 0;
        }
        return true;
    }

    public get byteLength(): number {
        let byteLength = 0;
        const { valueOffsets, values, nullBitmap, typeIds } = this;
        valueOffsets && (byteLength += valueOffsets.byteLength);
        values && (byteLength += values.byteLength);
        nullBitmap && (byteLength += nullBitmap.byteLength);
        typeIds && (byteLength += typeIds.byteLength);
        return this.children.reduce((byteLength, child) => byteLength + child.byteLength, byteLength);
    }

    protected _nullCount: number | kUnknownNullCount;

    public get nullCount(): number {
        if (DataType.isUnion(this.type)) {
            return this.children.reduce((nullCount, child) => nullCount + child.nullCount, 0);
        }
        let nullCount = this._nullCount;
        let nullBitmap: Uint8Array | undefined;
        if (nullCount <= kUnknownNullCount && (nullBitmap = this.nullBitmap)) {
            this._nullCount = nullCount = nullBitmap.length === 0 ?
                // no null bitmap, so all values are valid
                0 :
                this.length - popcnt_bit_range(nullBitmap, this.offset, this.offset + this.length);
        }
        return nullCount;
    }

    constructor(type: T, offset: number, length: number, nullCount?: number, buffers?: Partial<Buffers<T>> | Data<T>, children: Data[] = [], dictionary?: Vector) {
        this.type = type;
        this.children = children;
        this.dictionary = dictionary;
        this.offset = Math.floor(Math.max(offset || 0, 0));
        this.length = Math.floor(Math.max(length || 0, 0));
        this._nullCount = Math.floor(Math.max(nullCount || 0, -1));
        let buffer: Buffers<T>[keyof Buffers<T>];
        if (buffers instanceof Data) {
            this.stride = buffers.stride;
            this.values = buffers.values;
            this.typeIds = buffers.typeIds;
            this.nullBitmap = buffers.nullBitmap;
            this.valueOffsets = buffers.valueOffsets;
        } else {
            this.stride = strideForType(type);
            if (buffers) {
                (buffer = (buffers as Buffers<T>)[0]) && (this.valueOffsets = buffer);
                (buffer = (buffers as Buffers<T>)[1]) && (this.values = buffer);
                (buffer = (buffers as Buffers<T>)[2]) && (this.nullBitmap = buffer);
                (buffer = (buffers as Buffers<T>)[3]) && (this.typeIds = buffer);
            }
        }
    }

    public getValid(index: number): boolean {
        const { type } = this;
        if (DataType.isUnion(type)) {
            const union = (<unknown>type as Union);
            const child = this.children[union.typeIdToChildIndex[this.typeIds[index]]];
            const indexInChild = union.mode === UnionMode.Dense ? this.valueOffsets[index] : index;
            return child.getValid(indexInChild);
        }
        if (this.nullable && this.nullCount > 0) {
            const pos = this.offset + index;
            const val = this.nullBitmap[pos >> 3];
            return (val & (1 << (pos % 8))) !== 0;
        }
        return true;
    }

    public setValid(index: number, value: boolean): boolean {
        let prev: boolean;
        const { type } = this;
        if (DataType.isUnion(type)) {
            const union = (<unknown>type as Union);
            const child = this.children[union.typeIdToChildIndex[this.typeIds[index]]];
            const indexInChild = union.mode === UnionMode.Dense ? this.valueOffsets[index] : index;
            prev = child.getValid(indexInChild);
            child.setValid(indexInChild, value);
        } else {
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
                    nullBitmap.set(truncateBitmap(offset, length, this.nullBitmap), 0);
                    Object.assign(this, { nullBitmap });
                } else {
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

    public clone<R extends DataType = T>(type: R = this.type as any, offset = this.offset, length = this.length, nullCount = this._nullCount, buffers: Buffers<R> = <any>this, children: Data[] = this.children) {
        return new Data(type, offset, length, nullCount, buffers, children, this.dictionary);
    }

    public slice(offset: number, length: number): Data<T> {
        const { stride, typeId, children } = this;
        // +true === 1, +false === 0, so this means
        // we keep nullCount at 0 if it's already 0,
        // otherwise set to the invalidated flag -1
        const nullCount = +(this._nullCount === 0) - 1;
        const childStride = typeId === 16 /* FixedSizeList */ ? stride : 1;
        const buffers = this._sliceBuffers(offset, length, stride, typeId);
        return this.clone<T>(this.type, this.offset + offset, length, nullCount, buffers,
            // Don't slice children if we have value offsets (the variable-width types)
            (children.length === 0 || this.valueOffsets) ? children : this._sliceChildren(children, childStride * offset, childStride * length));
    }

    public _changeLengthAndBackfillNullBitmap(newLength: number): Data<T> {
        if (this.typeId === Type.Null) {
            return this.clone(this.type, 0, newLength, 0);
        }
        const { length, nullCount } = this;
        // start initialized with 0s (nulls), then fill from 0 to length with 1s (not null)
        const bitmap = new Uint8Array(((newLength + 63) & ~63) >> 3).fill(255, 0, length >> 3);
        // set all the bits in the last byte (up to bit `length - length % 8`) to 1 (not null)
        bitmap[length >> 3] = (1 << (length - (length & ~7))) - 1;
        // if we have a nullBitmap, truncate + slice and set it over the pre-filled 1s
        if (nullCount > 0) {
            bitmap.set(truncateBitmap(this.offset, length, this.nullBitmap), 0);
        }
        const buffers = this.buffers;
        buffers[BufferType.VALIDITY] = bitmap;
        return this.clone(this.type, 0, newLength, nullCount + (newLength - length), buffers);
    }

    protected _sliceBuffers(offset: number, length: number, stride: number, typeId: T['TType']): Buffers<T> {
        let arr: any;
        const { buffers } = this;
        // If typeIds exist, slice the typeIds buffer
        (arr = buffers[BufferType.TYPE]) && (buffers[BufferType.TYPE] = arr.subarray(offset, offset + length));
        // If offsets exist, only slice the offsets buffer
        (arr = buffers[BufferType.OFFSET]) && (buffers[BufferType.OFFSET] = arr.subarray(offset, offset + length + 1)) ||
            // Otherwise if no offsets, slice the data buffer. Don't slice the data vector for Booleans, since the offset goes by bits not bytes
            (arr = buffers[BufferType.DATA]) && (buffers[BufferType.DATA] = typeId === 6 ? arr : arr.subarray(stride * offset, stride * (offset + length)));
        return buffers;
    }

    protected _sliceChildren(children: Data[], offset: number, length: number): Data[] {
        return children.map((child) => child.slice(offset, length));
    }
}

(Data.prototype as any).children = Object.freeze([]);

import {
    Dictionary,
    Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct,
    Float,
    Int,
    Date_,
    Interval,
    Duration,
    Time,
    Timestamp,
    Union, DenseUnion, SparseUnion,
} from './type.js';

import { Visitor } from './visitor.js';
import { toArrayBufferView, toBigInt64Array, toInt32Array, toUint8Array } from './util/buffer.js';

class MakeDataVisitor extends Visitor {
    public visit<T extends DataType>(props: any): Data<T> {
        return this.getVisitFn(props['type']).call(this, props);
    }
    public visitNull<T extends Null>(props: NullDataProps<T>) {
        const {
            ['type']: type,
            ['offset']: offset = 0,
            ['length']: length = 0,
        } = props;
        return new Data(type, offset, length, length);
    }
    public visitBool<T extends Bool>(props: BoolDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length >> 3, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitInt<T extends Int>(props: IntDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitFloat<T extends Float>(props: FloatDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitUtf8<T extends Utf8>(props: Utf8DataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = toUint8Array(props['data']);
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toInt32Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    public visitLargeUtf8<T extends LargeUtf8>(props: LargeUtf8DataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = toUint8Array(props['data']);
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toBigInt64Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    public visitBinary<T extends Binary>(props: BinaryDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = toUint8Array(props['data']);
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toInt32Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    public visitLargeBinary<T extends LargeBinary>(props: LargeBinaryDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const data = toUint8Array(props['data']);
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toBigInt64Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, data, nullBitmap]);
    }
    public visitFixedSizeBinary<T extends FixedSizeBinary>(props: FixedSizeBinaryDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitDate<T extends Date_>(props: Date_DataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitTimestamp<T extends Timestamp>(props: TimestampDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitTime<T extends Time>(props: TimeDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitDecimal<T extends Decimal>(props: DecimalDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitList<T extends List>(props: ListDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toInt32Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, nullBitmap], [child]);
    }
    public visitStruct<T extends Struct>(props: StructDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0, ['children']: children = [] } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const {
            length = children.reduce((len, { length }) => Math.max(len, length), 0),
            nullCount = props['nullBitmap'] ? -1 : 0
        } = props;
        return new Data(type, offset, length, nullCount, [undefined, undefined, nullBitmap], children);
    }
    public visitUnion<T extends Union>(props: UnionDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0, ['children']: children = [] } = props;
        const typeIds = toArrayBufferView(type.ArrayType, props['typeIds']);
        const { ['length']: length = typeIds.length, ['nullCount']: nullCount = -1, } = props;
        if (DataType.isSparseUnion(type)) {
            return new Data(type, offset, length, nullCount, [undefined, undefined, undefined, typeIds], children);
        }
        const valueOffsets = toInt32Array(props['valueOffsets']);
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, undefined, typeIds], children);
    }
    public visitDictionary<T extends Dictionary>(props: DictionaryDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.indices.ArrayType, props['data']);
        const { ['dictionary']: dictionary = new Vector([new MakeDataVisitor().visit({ type: type.dictionary })]) } = props;
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap], [], dictionary);
    }
    public visitInterval<T extends Interval>(props: IntervalDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitDuration<T extends Duration>(props: DurationDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0 } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const data = toArrayBufferView(type.ArrayType, props['data']);
        const { ['length']: length = data.length, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [undefined, data, nullBitmap]);
    }
    public visitFixedSizeList<T extends FixedSizeList>(props: FixedSizeListDataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child = new MakeDataVisitor().visit({ type: type.valueType }) } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const { ['length']: length = child.length / strideForType(type), ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0 } = props;
        return new Data(type, offset, length, nullCount, [undefined, undefined, nullBitmap], [child]);
    }
    public visitMap<T extends Map_>(props: Map_DataProps<T>) {
        const { ['type']: type, ['offset']: offset = 0, ['child']: child = new MakeDataVisitor().visit({ type: type.childType }) } = props;
        const nullBitmap = toUint8Array(props['nullBitmap']);
        const valueOffsets = toInt32Array(props['valueOffsets']);
        const { ['length']: length = valueOffsets.length - 1, ['nullCount']: nullCount = props['nullBitmap'] ? -1 : 0, } = props;
        return new Data(type, offset, length, nullCount, [valueOffsets, undefined, nullBitmap], [child]);
    }
}

/** @ignore */
interface DataProps_<T extends DataType> {
    type: T;
    offset?: number;
    length?: number;
    nullCount?: number;
    nullBitmap?: NullBuffer;
}

interface NullDataProps<T extends Null> { type: T; offset?: number; length?: number }
interface IntDataProps<T extends Int> extends DataProps_<T> { data?: DataBuffer<T> }
interface DictionaryDataProps<T extends Dictionary> extends DataProps_<T> { data?: DataBuffer<T>; dictionary?: Vector<T['dictionary']> }
interface FloatDataProps<T extends Float> extends DataProps_<T> { data?: DataBuffer<T> }
interface BoolDataProps<T extends Bool> extends DataProps_<T> { data?: DataBuffer<T> }
interface DecimalDataProps<T extends Decimal> extends DataProps_<T> { data?: DataBuffer<T> }
interface Date_DataProps<T extends Date_> extends DataProps_<T> { data?: DataBuffer<T> }
interface TimeDataProps<T extends Time> extends DataProps_<T> { data?: DataBuffer<T> }
interface TimestampDataProps<T extends Timestamp> extends DataProps_<T> { data?: DataBuffer<T> }
interface IntervalDataProps<T extends Interval> extends DataProps_<T> { data?: DataBuffer<T> }
interface DurationDataProps<T extends Duration> extends DataProps_<T> { data?: DataBuffer<T> }
interface FixedSizeBinaryDataProps<T extends FixedSizeBinary> extends DataProps_<T> { data?: DataBuffer<T> }
interface BinaryDataProps<T extends Binary> extends DataProps_<T> { valueOffsets: ValueOffsetsBuffer; data?: DataBuffer<T> }
interface LargeBinaryDataProps<T extends LargeBinary> extends DataProps_<T> { valueOffsets: LargeValueOffsetsBuffer | ValueOffsetsBuffer; data?: DataBuffer<T> }
interface Utf8DataProps<T extends Utf8> extends DataProps_<T> { valueOffsets: ValueOffsetsBuffer; data?: DataBuffer<T> }
interface LargeUtf8DataProps<T extends LargeUtf8> extends DataProps_<T> { valueOffsets: LargeValueOffsetsBuffer | ValueOffsetsBuffer; data?: DataBuffer<T> }
interface ListDataProps<T extends List> extends DataProps_<T> { valueOffsets: ValueOffsetsBuffer; child: Data<T['valueType']> }
interface FixedSizeListDataProps<T extends FixedSizeList> extends DataProps_<T> { child: Data<T['valueType']> }
interface StructDataProps<T extends Struct> extends DataProps_<T> { children: Data[] }
interface Map_DataProps<T extends Map_> extends DataProps_<T> { valueOffsets: ValueOffsetsBuffer; child: Data }
interface SparseUnionDataProps<T extends SparseUnion> extends DataProps_<T> { nullBitmap: never; typeIds: TypeIdsBuffer; children: Data[] }
interface DenseUnionDataProps<T extends DenseUnion> extends DataProps_<T> { nullBitmap: never; typeIds: TypeIdsBuffer; children: Data[]; valueOffsets: ValueOffsetsBuffer }
interface UnionDataProps<T extends Union> extends DataProps_<T> { typeIds: TypeIdsBuffer; children: Data[]; valueOffsets?: ValueOffsetsBuffer }

export type DataProps<T extends DataType> = (
    T extends Null /*            */ ? NullDataProps<T> :
    T extends Int /*             */ ? IntDataProps<T> :
    T extends Dictionary /*      */ ? DictionaryDataProps<T> :
    T extends Float /*           */ ? FloatDataProps<T> :
    T extends Bool /*            */ ? BoolDataProps<T> :
    T extends Decimal /*         */ ? DecimalDataProps<T> :
    T extends Date_ /*           */ ? Date_DataProps<T> :
    T extends Time /*            */ ? TimeDataProps<T> :
    T extends Timestamp /*       */ ? TimestampDataProps<T> :
    T extends Interval /*        */ ? IntervalDataProps<T> :
    T extends Duration /*        */ ? DurationDataProps<T> :
    T extends FixedSizeBinary /* */ ? FixedSizeBinaryDataProps<T> :
    T extends Binary /*          */ ? BinaryDataProps<T> :
    T extends LargeBinary /*     */ ? LargeBinaryDataProps<T> :
    T extends Utf8 /*            */ ? Utf8DataProps<T> :
    T extends LargeUtf8 /*       */ ? LargeUtf8DataProps<T> :
    T extends List /*            */ ? ListDataProps<T> :
    T extends FixedSizeList /*   */ ? FixedSizeListDataProps<T> :
    T extends Struct /*          */ ? StructDataProps<T> :
    T extends Map_ /*            */ ? Map_DataProps<T> :
    T extends SparseUnion /*     */ ? SparseUnionDataProps<T> :
    T extends DenseUnion /*      */ ? DenseUnionDataProps<T> :
    T extends Union /*           */ ? UnionDataProps<T> :
 /*                                */ DataProps_<T>
);

const makeDataVisitor = new MakeDataVisitor();

export function makeData<T extends Null>(props: NullDataProps<T>): Data<T>;
export function makeData<T extends Int>(props: IntDataProps<T>): Data<T>;
export function makeData<T extends Dictionary>(props: DictionaryDataProps<T>): Data<T>;
export function makeData<T extends Float>(props: FloatDataProps<T>): Data<T>;
export function makeData<T extends Bool>(props: BoolDataProps<T>): Data<T>;
export function makeData<T extends Decimal>(props: DecimalDataProps<T>): Data<T>;
export function makeData<T extends Date_>(props: Date_DataProps<T>): Data<T>;
export function makeData<T extends Time>(props: TimeDataProps<T>): Data<T>;
export function makeData<T extends Timestamp>(props: TimestampDataProps<T>): Data<T>;
export function makeData<T extends Interval>(props: IntervalDataProps<T>): Data<T>;
export function makeData<T extends Duration>(props: DurationDataProps<T>): Data<T>;
export function makeData<T extends FixedSizeBinary>(props: FixedSizeBinaryDataProps<T>): Data<T>;
export function makeData<T extends Binary>(props: BinaryDataProps<T>): Data<T>;
export function makeData<T extends LargeBinary>(props: LargeBinaryDataProps<T>): Data<T>;
export function makeData<T extends Utf8>(props: Utf8DataProps<T>): Data<T>;
export function makeData<T extends LargeUtf8>(props: LargeUtf8DataProps<T>): Data<T>;
export function makeData<T extends List>(props: ListDataProps<T>): Data<T>;
export function makeData<T extends FixedSizeList>(props: FixedSizeListDataProps<T>): Data<T>;
export function makeData<T extends Struct>(props: StructDataProps<T>): Data<T>;
export function makeData<T extends Map_>(props: Map_DataProps<T>): Data<T>;
export function makeData<T extends SparseUnion>(props: SparseUnionDataProps<T>): Data<T>;
export function makeData<T extends DenseUnion>(props: DenseUnionDataProps<T>): Data<T>;
export function makeData<T extends Union>(props: UnionDataProps<T>): Data<T>;
export function makeData<T extends DataType>(props: DataProps_<T>): Data<T>;
export function makeData(props: any) {
    return makeDataVisitor.visit(props);
}
