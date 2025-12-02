/// <reference types="node" />
import { Vector } from './vector.js';
import { Data } from './data.js';
import { DataType, Float, Int, Decimal, FixedSizeBinary, Date_, Time, Timestamp, Interval, Duration, Utf8, LargeUtf8, Binary, LargeBinary, List, Map_ } from './type.js';
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
    children?: {
        [key: string]: BuilderOptions;
    } | BuilderOptions[];
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
export declare abstract class Builder<T extends DataType = any, TNull = any> {
    /** @nocollapse */
    static throughNode<T extends DataType = any, TNull = any>(options: BuilderDuplexOptions<T, TNull>): Duplex;
    /** @nocollapse */
    static throughDOM<T extends DataType = any, TNull = any>(options: BuilderTransformOptions<T, TNull>): BuilderTransform<T, TNull>;
    /**
     * Construct a builder with the given Arrow DataType with optional null values,
     * which will be interpreted as "null" when set or appended to the `Builder`.
     * @param {{ type: T, nullValues?: any[] }} options A `BuilderOptions` object used to create this `Builder`.
     */
    constructor({ 'type': type, 'nullValues': nulls }: BuilderOptions<T, TNull>);
    /**
     * The Builder's `DataType` instance.
     * @readonly
     */
    type: T;
    /**
     * The number of values written to the `Builder` that haven't been flushed yet.
     * @readonly
     */
    length: number;
    /**
     * A boolean indicating whether `Builder.prototype.finish()` has been called on this `Builder`.
     * @readonly
     */
    finished: boolean;
    /**
     * The number of elements in the underlying values TypedArray that
     * represent a single logical element, determined by this Builder's
     * `DataType`. This is 1 for most types, but is larger when the `DataType`
     * is `Int64`, `Uint64`, `Decimal`, `DateMillisecond`, certain variants of
     * `Interval`, `Time`, or `Timestamp`, `FixedSizeBinary`, and `FixedSizeList`.
     * @readonly
     */
    readonly stride: number;
    readonly children: Builder[];
    /**
     * The list of null-value sentinels for this `Builder`. When one of these values
     * is written to the `Builder` (either via `Builder.prototype.set()` or `Builder.prototype.append()`),
     * a 1-bit is written to this Builder's underlying null BitmapBufferBuilder.
     * @readonly
     */
    readonly nullValues?: TNull[] | ReadonlyArray<TNull> | null;
    /**
     * Flush the `Builder` and return a `Vector<T>`.
     * @returns {Vector<T>} A `Vector<T>` of the flushed values.
     */
    toVector(): Vector<T>;
    get ArrayType(): any;
    get nullCount(): number;
    get numChildren(): number;
    /**
     * @returns The aggregate length (in bytes) of the values that have been written.
     */
    get byteLength(): number;
    /**
     * @returns The aggregate number of rows that have been reserved to write new values.
     */
    get reservedLength(): number;
    /**
     * @returns The aggregate length (in bytes) that has been reserved to write new values.
     */
    get reservedByteLength(): number;
    protected _offsets: DataBufferBuilder<T['TOffsetArray']>;
    get valueOffsets(): T["TOffsetArray"] | null;
    protected _values: BufferBuilder<T['TArray']>;
    get values(): T["TArray"] | null;
    protected _nulls: BitmapBufferBuilder;
    get nullBitmap(): Uint8Array | null;
    protected _typeIds: DataBufferBuilder<Int8Array>;
    get typeIds(): Int8Array | null;
    protected _isValid: (value: T['TValue'] | TNull) => boolean;
    protected _setValue: (inst: Builder<T>, index: number, value: T['TValue']) => void;
    /**
     * Appends a value (or null) to this `Builder`.
     * This is equivalent to `builder.set(builder.length, value)`.
     * @param {T['TValue'] | TNull } value The value to append.
     */
    append(value: T['TValue'] | TNull): this;
    /**
     * Validates whether a value is valid (true), or null (false)
     * @param {T['TValue'] | TNull } value The value to compare against null the value representations
     */
    isValid(value: T['TValue'] | TNull): boolean;
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
    set(index: number, value: T['TValue'] | TNull): this;
    /**
     * Write a value to the underlying buffers at the supplied index, bypassing
     * the null-value check. This is a low-level method that
     * @param {number} index
     * @param {T['TValue'] | TNull } value
     */
    setValue(index: number, value: T['TValue']): void;
    setValid(index: number, valid: boolean): boolean;
    addChild(child: Builder, name?: string): void;
    /**
     * Retrieve the child `Builder` at the supplied `index`, or null if no child
     * exists at that index.
     * @param {number} index The index of the child `Builder` to retrieve.
     * @returns {Builder | null} The child Builder at the supplied index or null.
     */
    getChildAt<R extends DataType = any>(index: number): Builder<R> | null;
    /**
     * Commit all the values that have been written to their underlying
     * ArrayBuffers, including any child Builders if applicable, and reset
     * the internal `Builder` state.
     * @returns A `Data<T>` of the buffers and children representing the values written.
     */
    flush(): Data<T>;
    /**
     * Finalize this `Builder`, and child builders if applicable.
     * @returns {this} The finalized `Builder` instance.
     */
    finish(): this;
    /**
     * Clear this Builder's internal state, including child Builders if applicable, and reset the length to 0.
     * @returns {this} The cleared `Builder` instance.
     */
    clear(): this;
}
/** @ignore */
export declare abstract class FixedWidthBuilder<T extends Int | Float | FixedSizeBinary | Date_ | Timestamp | Time | Decimal | Interval | Duration = any, TNull = any> extends Builder<T, TNull> {
    constructor(opts: BuilderOptions<T, TNull>);
    setValue(index: number, value: T['TValue']): void;
}
/** @ignore */
export declare abstract class VariableWidthBuilder<T extends Binary | LargeBinary | Utf8 | LargeUtf8 | List | Map_, TNull = any> extends Builder<T, TNull> {
    protected _pendingLength: number;
    protected _offsets: OffsetsBufferBuilder<T>;
    protected _pending: Map<number, any> | undefined;
    constructor(opts: BuilderOptions<T, TNull>);
    setValue(index: number, value: T['TValue']): void;
    setValid(index: number, isValid: boolean): boolean;
    clear(): this;
    flush(): Data<T>;
    finish(): this;
    protected _flush(): this;
    protected abstract _flushPending(pending: Map<number, any>, pendingLength: number): void;
}
