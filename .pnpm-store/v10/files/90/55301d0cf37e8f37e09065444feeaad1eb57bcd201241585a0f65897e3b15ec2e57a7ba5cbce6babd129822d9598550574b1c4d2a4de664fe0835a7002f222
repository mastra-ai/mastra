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
import { Vector } from './vector.mjs';
import { makeData } from './data.mjs';
import { MapRow, kKeys } from './row/map.mjs';
import { strideForType, } from './type.mjs';
import { createIsValidFunction } from './builder/valid.mjs';
import { BitmapBufferBuilder, DataBufferBuilder, OffsetsBufferBuilder } from './builder/buffer.mjs';
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
export class Builder {
    /** @nocollapse */
    // @ts-ignore
    static throughNode(options) {
        throw new Error(`"throughNode" not available in this environment`);
    }
    /** @nocollapse */
    // @ts-ignore
    static throughDOM(options) {
        throw new Error(`"throughDOM" not available in this environment`);
    }
    /**
     * Construct a builder with the given Arrow DataType with optional null values,
     * which will be interpreted as "null" when set or appended to the `Builder`.
     * @param {{ type: T, nullValues?: any[] }} options A `BuilderOptions` object used to create this `Builder`.
     */
    constructor({ 'type': type, 'nullValues': nulls }) {
        /**
         * The number of values written to the `Builder` that haven't been flushed yet.
         * @readonly
         */
        this.length = 0;
        /**
         * A boolean indicating whether `Builder.prototype.finish()` has been called on this `Builder`.
         * @readonly
         */
        this.finished = false;
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
     * Flush the `Builder` and return a `Vector<T>`.
     * @returns {Vector<T>} A `Vector<T>` of the flushed values.
     */
    toVector() { return new Vector([this.flush()]); }
    get ArrayType() { return this.type.ArrayType; }
    get nullCount() { return this._nulls.numInvalid; }
    get numChildren() { return this.children.length; }
    /**
     * @returns The aggregate length (in bytes) of the values that have been written.
     */
    get byteLength() {
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
    get reservedLength() {
        return this._nulls.reservedLength;
    }
    /**
     * @returns The aggregate length (in bytes) that has been reserved to write new values.
     */
    get reservedByteLength() {
        let size = 0;
        this._offsets && (size += this._offsets.reservedByteLength);
        this._values && (size += this._values.reservedByteLength);
        this._nulls && (size += this._nulls.reservedByteLength);
        this._typeIds && (size += this._typeIds.reservedByteLength);
        return this.children.reduce((size, child) => size + child.reservedByteLength, size);
    }
    get valueOffsets() { return this._offsets ? this._offsets.buffer : null; }
    get values() { return this._values ? this._values.buffer : null; }
    get nullBitmap() { return this._nulls ? this._nulls.buffer : null; }
    get typeIds() { return this._typeIds ? this._typeIds.buffer : null; }
    /**
     * Appends a value (or null) to this `Builder`.
     * This is equivalent to `builder.set(builder.length, value)`.
     * @param {T['TValue'] | TNull } value The value to append.
     */
    append(value) { return this.set(this.length, value); }
    /**
     * Validates whether a value is valid (true), or null (false)
     * @param {T['TValue'] | TNull } value The value to compare against null the value representations
     */
    isValid(value) { return this._isValid(value); }
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
    set(index, value) {
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
    setValue(index, value) { this._setValue(this, index, value); }
    setValid(index, valid) {
        this.length = this._nulls.set(index, +valid).length;
        return valid;
    }
    // @ts-ignore
    addChild(child, name = `${this.numChildren}`) {
        throw new Error(`Cannot append children to non-nested type "${this.type}"`);
    }
    /**
     * Retrieve the child `Builder` at the supplied `index`, or null if no child
     * exists at that index.
     * @param {number} index The index of the child `Builder` to retrieve.
     * @returns {Builder | null} The child Builder at the supplied index or null.
     */
    getChildAt(index) {
        return this.children[index] || null;
    }
    /**
     * Commit all the values that have been written to their underlying
     * ArrayBuffers, including any child Builders if applicable, and reset
     * the internal `Builder` state.
     * @returns A `Data<T>` of the buffers and children representing the values written.
     */
    flush() {
        let data;
        let typeIds;
        let nullBitmap;
        let valueOffsets;
        const { type, length, nullCount, _typeIds, _offsets, _values, _nulls } = this;
        if (typeIds = _typeIds === null || _typeIds === void 0 ? void 0 : _typeIds.flush(length)) { // Unions, DenseUnions
            valueOffsets = _offsets === null || _offsets === void 0 ? void 0 : _offsets.flush(length);
        }
        else if (valueOffsets = _offsets === null || _offsets === void 0 ? void 0 : _offsets.flush(length)) { // Variable-width primitives (Binary, LargeBinary, Utf8, LargeUtf8), and Lists
            data = _values === null || _values === void 0 ? void 0 : _values.flush(_offsets.last());
        }
        else { // Fixed-width primitives (Int, Float, Decimal, Time, Timestamp, Duration and Interval)
            data = _values === null || _values === void 0 ? void 0 : _values.flush(length);
        }
        if (nullCount > 0) {
            nullBitmap = _nulls === null || _nulls === void 0 ? void 0 : _nulls.flush(length);
        }
        const children = this.children.map((child) => child.flush());
        this.clear();
        return makeData({
            type, length, nullCount,
            children, 'child': children[0],
            data, typeIds, nullBitmap, valueOffsets,
        });
    }
    /**
     * Finalize this `Builder`, and child builders if applicable.
     * @returns {this} The finalized `Builder` instance.
     */
    finish() {
        this.finished = true;
        for (const child of this.children)
            child.finish();
        return this;
    }
    /**
     * Clear this Builder's internal state, including child Builders if applicable, and reset the length to 0.
     * @returns {this} The cleared `Builder` instance.
     */
    clear() {
        var _a, _b, _c, _d;
        this.length = 0;
        (_a = this._nulls) === null || _a === void 0 ? void 0 : _a.clear();
        (_b = this._values) === null || _b === void 0 ? void 0 : _b.clear();
        (_c = this._offsets) === null || _c === void 0 ? void 0 : _c.clear();
        (_d = this._typeIds) === null || _d === void 0 ? void 0 : _d.clear();
        for (const child of this.children)
            child.clear();
        return this;
    }
}
Builder.prototype.length = 1;
Builder.prototype.stride = 1;
Builder.prototype.children = null;
Builder.prototype.finished = false;
Builder.prototype.nullValues = null;
Builder.prototype._isValid = () => true;
/** @ignore */
export class FixedWidthBuilder extends Builder {
    constructor(opts) {
        super(opts);
        this._values = new DataBufferBuilder(this.ArrayType, 0, this.stride);
    }
    setValue(index, value) {
        const values = this._values;
        values.reserve(index - values.length + 1);
        return super.setValue(index, value);
    }
}
/** @ignore */
export class VariableWidthBuilder extends Builder {
    constructor(opts) {
        super(opts);
        this._pendingLength = 0;
        this._offsets = new OffsetsBufferBuilder(opts.type);
    }
    setValue(index, value) {
        const pending = this._pending || (this._pending = new Map());
        const current = pending.get(index);
        current && (this._pendingLength -= current.length);
        this._pendingLength += (value instanceof MapRow) ? value[kKeys].length : value.length;
        pending.set(index, value);
    }
    setValid(index, isValid) {
        if (!super.setValid(index, isValid)) {
            (this._pending || (this._pending = new Map())).set(index, undefined);
            return false;
        }
        return true;
    }
    clear() {
        this._pendingLength = 0;
        this._pending = undefined;
        return super.clear();
    }
    flush() {
        this._flush();
        return super.flush();
    }
    finish() {
        this._flush();
        return super.finish();
    }
    _flush() {
        const pending = this._pending;
        const pendingLength = this._pendingLength;
        this._pendingLength = 0;
        this._pending = undefined;
        if (pending && pending.size > 0) {
            this._flushPending(pending, pendingLength);
        }
        return this;
    }
}

//# sourceMappingURL=builder.mjs.map
