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
import { Data, makeData } from './data.js';
import { MapRow, kKeys } from './row/map.js';
import {
    DataType, strideForType,
    Float, Int, Decimal, FixedSizeBinary,
    Date_, Time, Timestamp, Interval, Duration,
    Utf8, LargeUtf8, Binary, LargeBinary, List, Map_,
} from './type.js';
import { createIsValidFunction } from './builder/valid.js';
import { BufferBuilder, BitmapBufferBuilder, DataBufferBuilder, OffsetsBufferBuilder } from './builder/buffer.js';

import type { BuilderDuplexOptions } from './io/node/builder.js';
import type { BuilderTransform, BuilderTransformOptions } from './io/whatwg/builder.js';

import type { Duplex } from 'node:stream';

/**
 * A set of options required to create a `Builder` instance for a given `DataType`.
 * @see {@link Builder}
 */
export interface BuilderOptions<T extends DataType = any, TNull = any> {
    type: T;
    nullValues?: TNull[] | ReadonlyArray<TNull> | null;
    children?: { [key: string]: BuilderOptions } | BuilderOptions[];
}

/**
 * An abstract base class for types that construct Arrow Vectors from arbitrary JavaScript values.
 *
 * A `Builder` is responsible for writing arbitrary JavaScript values
 * to ArrayBuffers and/or child Builders according to the Arrow specification
 * for each DataType, creating or resizing the underlying ArrayBuffers as necessary.
 *
 * The `Builder` for each Arrow `DataType` handles converting and appending
 * values for a given `DataType`. The high-level {@link makeBuilder `makeBuilder()`} convenience
 * method creates the specific `Builder` subclass for the supplied `DataType`.
 *
 * Once created, `Builder` instances support both appending values to the end
 * of the `Builder`, and random-access writes to specific indices
 * (`Builder.prototype.append(value)` is a convenience method for
 * `builder.set(builder.length, value)`). Appending or setting values beyond the
 * Builder's current length may cause the builder to grow its underlying buffers
 * or child Builders (if applicable) to accommodate the new values.
 *
 * After enough values have been written to a `Builder`, `Builder.prototype.flush()`
 * will commit the values to the underlying ArrayBuffers (or child Builders). The
 * internal Builder state will be reset, and an instance of `Data<T>` is returned.
 * Alternatively, `Builder.prototype.toVector()` will flush the `Builder` and return
 * an instance of `Vector<T>` instead.
 *
 * When there are no more values to write, use `Builder.prototype.finish()` to
 * finalize the `Builder`. This does not reset the internal state, so it is
 * necessary to call `Builder.prototype.flush()` or `toVector()` one last time
 * if there are still values queued to be flushed.
 *
 * Note: calling `Builder.prototype.finish()` is required when using a `DictionaryBuilder`,
 * because this is when it flushes the values that have been enqueued in its internal
 * dictionary's `Builder`, and creates the `dictionaryVector` for the `Dictionary` `DataType`.
 *
 * @example
 * ```ts
 * import { makeBuilder, Utf8 } from 'apache-arrow';
 *
 * const utf8Builder = makeBuilder({
 *     type: new Utf8(),
 *     nullValues: [null, 'n/a']
 * });
 *
 * utf8Builder
 *     .append('hello')
 *     .append('n/a')
 *     .append('world')
 *     .append(null);
 *
 * const utf8Vector = utf8Builder.finish().toVector();
 *
 * console.log(utf8Vector.toJSON());
 * // > ["hello", null, "world", null]
 * ```
 *
 * @typeparam T The `DataType` of this `Builder`.
 * @typeparam TNull The type(s) of values which will be considered null-value sentinels.
 */
export abstract class Builder<T extends DataType = any, TNull = any> {

    /** @nocollapse */
    // @ts-ignore
    public static throughNode<T extends DataType = any, TNull = any>(options: BuilderDuplexOptions<T, TNull>): Duplex {
        throw new Error(`"throughNode" not available in this environment`);
    }
    /** @nocollapse */
    // @ts-ignore
    public static throughDOM<T extends DataType = any, TNull = any>(options: BuilderTransformOptions<T, TNull>): BuilderTransform<T, TNull> {
        throw new Error(`"throughDOM" not available in this environment`);
    }

    /**
     * Construct a builder with the given Arrow DataType with optional null values,
     * which will be interpreted as "null" when set or appended to the `Builder`.
     * @param {{ type: T, nullValues?: any[] }} options A `BuilderOptions` object used to create this `Builder`.
     */
    constructor({ 'type': type, 'nullValues': nulls }: BuilderOptions<T, TNull>) {
        this.type = type;
        this.children = [];
        this.nullValues = nulls;
        this.stride = strideForType(type);
        this._nulls = new BitmapBufferBuilder();
        if (nulls && nulls.length > 0) {
            this._isValid = createIsValidFunction(nulls);
        }
    }

    /**
     * The Builder's `DataType` instance.
     * @readonly
     */
    public type: T;
    /**
     * The number of values written to the `Builder` that haven't been flushed yet.
     * @readonly
     */
    public length = 0;
    /**
     * A boolean indicating whether `Builder.prototype.finish()` has been called on this `Builder`.
     * @readonly
     */
    public finished = false;
    /**
     * The number of elements in the underlying values TypedArray that
     * represent a single logical element, determined by this Builder's
     * `DataType`. This is 1 for most types, but is larger when the `DataType`
     * is `Int64`, `Uint64`, `Decimal`, `DateMillisecond`, certain variants of
     * `Interval`, `Time`, or `Timestamp`, `FixedSizeBinary`, and `FixedSizeList`.
     * @readonly
     */
    public readonly stride: number;
    public readonly children: Builder[];
    /**
     * The list of null-value sentinels for this `Builder`. When one of these values
     * is written to the `Builder` (either via `Builder.prototype.set()` or `Builder.prototype.append()`),
     * a 1-bit is written to this Builder's underlying null BitmapBufferBuilder.
     * @readonly
     */
    public readonly nullValues?: TNull[] | ReadonlyArray<TNull> | null;

    /**
     * Flush the `Builder` and return a `Vector<T>`.
     * @returns {Vector<T>} A `Vector<T>` of the flushed values.
     */
    public toVector() { return new Vector([this.flush()]); }

    public get ArrayType() { return this.type.ArrayType; }
    public get nullCount() { return this._nulls.numInvalid; }
    public get numChildren() { return this.children.length; }

    /**
     * @returns The aggregate length (in bytes) of the values that have been written.
     */
    public get byteLength(): number {
        let size = 0;
        const { _offsets, _values, _nulls, _typeIds, children } = this;
        _offsets && (size += _offsets.byteLength);
        _values && (size += _values.byteLength);
        _nulls && (size += _nulls.byteLength);
        _typeIds && (size += _typeIds.byteLength);
        return children.reduce((size, child) => size + child.byteLength, size);
    }

    /**
     * @returns The aggregate number of rows that have been reserved to write new values.
     */
    public get reservedLength(): number {
        return this._nulls.reservedLength;
    }

    /**
     * @returns The aggregate length (in bytes) that has been reserved to write new values.
     */
    public get reservedByteLength(): number {
        let size = 0;
        this._offsets && (size += this._offsets.reservedByteLength);
        this._values && (size += this._values.reservedByteLength);
        this._nulls && (size += this._nulls.reservedByteLength);
        this._typeIds && (size += this._typeIds.reservedByteLength);
        return this.children.reduce((size, child) => size + child.reservedByteLength, size);
    }

    declare protected _offsets: DataBufferBuilder<T['TOffsetArray']>;
    public get valueOffsets() { return this._offsets ? this._offsets.buffer : null; }

    declare protected _values: BufferBuilder<T['TArray']>;
    public get values() { return this._values ? this._values.buffer : null; }

    declare protected _nulls: BitmapBufferBuilder;
    public get nullBitmap() { return this._nulls ? this._nulls.buffer : null; }

    declare protected _typeIds: DataBufferBuilder<Int8Array>;
    public get typeIds() { return this._typeIds ? this._typeIds.buffer : null; }

    declare protected _isValid: (value: T['TValue'] | TNull) => boolean;
    declare protected _setValue: (inst: Builder<T>, index: number, value: T['TValue']) => void;

    /**
     * Appends a value (or null) to this `Builder`.
     * This is equivalent to `builder.set(builder.length, value)`.
     * @param {T['TValue'] | TNull } value The value to append.
     */
    public append(value: T['TValue'] | TNull) { return this.set(this.length, value); }

    /**
     * Validates whether a value is valid (true), or null (false)
     * @param {T['TValue'] | TNull } value The value to compare against null the value representations
     */
    public isValid(value: T['TValue'] | TNull): boolean { return this._isValid(value); }

    /**
     * Write a value (or null-value sentinel) at the supplied index.
     * If the value matches one of the null-value representations, a 1-bit is
     * written to the null `BitmapBufferBuilder`. Otherwise, a 0 is written to
     * the null `BitmapBufferBuilder`, and the value is passed to
     * `Builder.prototype.setValue()`.
     * @param {number} index The index of the value to write.
     * @param {T['TValue'] | TNull } value The value to write at the supplied index.
     * @returns {this} The updated `Builder` instance.
     */
    public set(index: number, value: T['TValue'] | TNull) {
        if (this.setValid(index, this.isValid(value))) {
            this.setValue(index, value);
        }
        return this;
    }

    /**
     * Write a value to the underlying buffers at the supplied index, bypassing
     * the null-value check. This is a low-level method that
     * @param {number} index
     * @param {T['TValue'] | TNull } value
     */
    public setValue(index: number, value: T['TValue']) { this._setValue(this, index, value); }
    public setValid(index: number, valid: boolean) {
        this.length = this._nulls.set(index, +valid).length;
        return valid;
    }

    // @ts-ignore
    public addChild(child: Builder, name = `${this.numChildren}`) {
        throw new Error(`Cannot append children to non-nested type "${this.type}"`);
    }

    /**
     * Retrieve the child `Builder` at the supplied `index`, or null if no child
     * exists at that index.
     * @param {number} index The index of the child `Builder` to retrieve.
     * @returns {Builder | null} The child Builder at the supplied index or null.
     */
    public getChildAt<R extends DataType = any>(index: number): Builder<R> | null {
        return this.children[index] || null;
    }

    /**
     * Commit all the values that have been written to their underlying
     * ArrayBuffers, including any child Builders if applicable, and reset
     * the internal `Builder` state.
     * @returns A `Data<T>` of the buffers and children representing the values written.
     */
    public flush(): Data<T> {
        let data: BufferBuilder<T['TArray']> | undefined;
        let typeIds: Int8Array;
        let nullBitmap: Uint8Array | undefined;
        let valueOffsets: T['TOffsetArray'];
        const { type, length, nullCount, _typeIds, _offsets, _values, _nulls } = this;

        if (typeIds = _typeIds?.flush(length)) { // Unions, DenseUnions
            valueOffsets = _offsets?.flush(length);
        } else if (valueOffsets = _offsets?.flush(length)) { // Variable-width primitives (Binary, LargeBinary, Utf8, LargeUtf8), and Lists
            data = _values?.flush(_offsets.last());
        } else { // Fixed-width primitives (Int, Float, Decimal, Time, Timestamp, Duration and Interval)
            data = _values?.flush(length);
        }

        if (nullCount > 0) {
            nullBitmap = _nulls?.flush(length);
        }

        const children = this.children.map((child) => child.flush());

        this.clear();

        return makeData(<any>{
            type, length, nullCount,
            children, 'child': children[0],
            data, typeIds, nullBitmap, valueOffsets,
        }) as Data<T>;
    }

    /**
     * Finalize this `Builder`, and child builders if applicable.
     * @returns {this} The finalized `Builder` instance.
     */
    public finish() {
        this.finished = true;
        for (const child of this.children) child.finish();
        return this;
    }

    /**
     * Clear this Builder's internal state, including child Builders if applicable, and reset the length to 0.
     * @returns {this} The cleared `Builder` instance.
     */
    public clear() {
        this.length = 0;
        this._nulls?.clear();
        this._values?.clear();
        this._offsets?.clear();
        this._typeIds?.clear();
        for (const child of this.children) child.clear();
        return this;
    }
}

(Builder.prototype as any).length = 1;
(Builder.prototype as any).stride = 1;
(Builder.prototype as any).children = null;
(Builder.prototype as any).finished = false;
(Builder.prototype as any).nullValues = null;
(Builder.prototype as any)._isValid = () => true;

/** @ignore */
export abstract class FixedWidthBuilder<T extends Int | Float | FixedSizeBinary | Date_ | Timestamp | Time | Decimal | Interval | Duration = any, TNull = any> extends Builder<T, TNull> {
    constructor(opts: BuilderOptions<T, TNull>) {
        super(opts);
        this._values = new DataBufferBuilder(this.ArrayType, 0, this.stride);
    }
    public setValue(index: number, value: T['TValue']) {
        const values = this._values;
        values.reserve(index - values.length + 1);
        return super.setValue(index, value);
    }
}

/** @ignore */
export abstract class VariableWidthBuilder<T extends Binary | LargeBinary | Utf8 | LargeUtf8 | List | Map_, TNull = any> extends Builder<T, TNull> {
    protected _pendingLength = 0;
    protected _offsets: OffsetsBufferBuilder<T>;
    protected _pending: Map<number, any> | undefined;
    constructor(opts: BuilderOptions<T, TNull>) {
        super(opts);
        this._offsets = new OffsetsBufferBuilder(opts.type);
    }
    public setValue(index: number, value: T['TValue']) {
        const pending = this._pending || (this._pending = new Map());
        const current = pending.get(index);
        current && (this._pendingLength -= current.length);
        this._pendingLength += (value instanceof MapRow) ? value[kKeys].length : value.length;
        pending.set(index, value);
    }
    public setValid(index: number, isValid: boolean) {
        if (!super.setValid(index, isValid)) {
            (this._pending || (this._pending = new Map())).set(index, undefined);
            return false;
        }
        return true;
    }
    public clear() {
        this._pendingLength = 0;
        this._pending = undefined;
        return super.clear();
    }
    public flush() {
        this._flush();
        return super.flush();
    }
    public finish() {
        this._flush();
        return super.finish();
    }
    protected _flush() {
        const pending = this._pending;
        const pendingLength = this._pendingLength;
        this._pendingLength = 0;
        this._pending = undefined;
        if (pending && pending.size > 0) {
            this._flushPending(pending, pendingLength);
        }
        return this;
    }
    protected abstract _flushPending(pending: Map<number, any>, pendingLength: number): void;
}
