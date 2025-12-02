import * as dtypes from './type.js';
import { Data, DataProps } from './data.js';
import { BuilderType, JavaScriptDataType } from './interfaces.js';
import { Vector } from './vector.js';
import { Builder, BuilderOptions } from './builder.js';
import { ArrayDataType, BigIntArray, JavaScriptArrayDataType, TypedArray, TypedArrayDataType } from './interfaces.js';
import { Table } from './table.js';
export declare function makeBuilder<T extends dtypes.DataType = any, TNull = any>(options: BuilderOptions<T, TNull>): BuilderType<T, TNull>;
/**
 * Creates a Vector from a JavaScript array via a {@link Builder}.
 * Use {@link makeVector} if you only want to create a vector from a typed array.
 *
 * @example
 * ```ts
 * const vf64 = vectorFromArray([1, 2, 3]);
 * const vi8 = vectorFromArray([1, 2, 3], new Int8);
 * const vdict = vectorFromArray(['foo', 'bar']);
 * const vstruct = vectorFromArray([{a: 'foo', b: 42}, {a: 'bar', b: 12}]);
 * ```
 */
export declare function vectorFromArray(values: readonly (null | undefined)[], type?: dtypes.Null): Vector<dtypes.Null>;
export declare function vectorFromArray(values: readonly (null | undefined | boolean)[], type?: dtypes.Bool): Vector<dtypes.Bool>;
export declare function vectorFromArray<T extends dtypes.Utf8 | dtypes.Dictionary<dtypes.Utf8> = dtypes.Dictionary<dtypes.Utf8, dtypes.Int32>>(values: readonly (null | undefined | string)[], type?: T): Vector<T>;
export declare function vectorFromArray<T extends dtypes.TimestampMillisecond>(values: readonly (null | undefined | Date)[], type?: T): Vector<T>;
export declare function vectorFromArray<T extends dtypes.Int>(values: readonly (null | undefined | number)[], type: T): Vector<T>;
export declare function vectorFromArray<T extends dtypes.Int64 | dtypes.Uint64 = dtypes.Int64>(values: readonly (null | undefined | bigint)[], type?: T): Vector<T>;
export declare function vectorFromArray<T extends dtypes.Float = dtypes.Float64>(values: readonly (null | undefined | number)[], type?: T): Vector<T>;
export declare function vectorFromArray<T extends dtypes.DataType>(values: readonly (unknown)[], type: T): Vector<T>;
export declare function vectorFromArray<T extends readonly unknown[]>(values: T): Vector<JavaScriptArrayDataType<T>>;
/** Creates a Vector from a typed array via {@link makeVector}. */
export declare function vectorFromArray<T extends TypedArray | BigIntArray>(data: T): Vector<TypedArrayDataType<T>>;
export declare function vectorFromArray<T extends dtypes.DataType>(data: Data<T>): Vector<T>;
export declare function vectorFromArray<T extends dtypes.DataType>(data: Vector<T>): Vector<T>;
export declare function vectorFromArray<T extends dtypes.DataType>(data: DataProps<T>): Vector<T>;
export declare function vectorFromArray<T extends TypedArray | BigIntArray | readonly unknown[]>(data: T): Vector<ArrayDataType<T>>;
/**
 * Creates a {@link Table} from an array of objects.
 *
 * @param array A table of objects.
 */
export declare function tableFromJSON<T extends Record<string, unknown>>(array: T[]): Table<{
    [P in keyof T]: JavaScriptDataType<T[P]>;
}>;
/**
 * A set of options to create an Iterable or AsyncIterable `Builder` transform function.
 * @see {@link builderThroughIterable}
 * @see {@link builderThroughAsyncIterable}
 */
export interface IterableBuilderOptions<T extends dtypes.DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    highWaterMark?: number;
    queueingStrategy?: 'bytes' | 'count';
    dictionaryHashFunction?: (value: any) => string | number;
    valueToChildTypeId?: (builder: Builder<T, TNull>, value: any, offset: number) => number;
}
/** @ignore */
type ThroughIterable<T extends dtypes.DataType = any, TNull = any> = (source: Iterable<T['TValue'] | TNull>) => IterableIterator<Vector<T>>;
/**
 * Transform a synchronous `Iterable` of arbitrary JavaScript values into a
 * sequence of Arrow Vector<T> following the chunking semantics defined in
 * the supplied `options` argument.
 *
 * This function returns a function that accepts an `Iterable` of values to
 * transform. When called, this function returns an Iterator of `Vector<T>`.
 *
 * The resulting `Iterator<Vector<T>>` yields Vectors based on the
 * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
 *
 * * If `queueingStrategy` is `"count"` (or omitted), The `Iterator<Vector<T>>`
 *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
 *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
 * * If `queueingStrategy` is `"bytes"`, the `Iterator<Vector<T>>` will flush
 *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
 *   reaches or exceeds the supplied `highWaterMark`.
 *
 * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
 * @returns A function which accepts a JavaScript `Iterable` of values to
 *          write, and returns an `Iterator` that yields Vectors according
 *          to the chunking semantics defined in the `options` argument.
 * @nocollapse
 */
export declare function builderThroughIterable<T extends dtypes.DataType = any, TNull = any>(options: IterableBuilderOptions<T, TNull>): ThroughIterable<T, TNull>;
/** @ignore */
type ThroughAsyncIterable<T extends dtypes.DataType = any, TNull = any> = (source: Iterable<T['TValue'] | TNull> | AsyncIterable<T['TValue'] | TNull>) => AsyncIterableIterator<Vector<T>>;
/**
 * Transform an `AsyncIterable` of arbitrary JavaScript values into a
 * sequence of Arrow Vector<T> following the chunking semantics defined in
 * the supplied `options` argument.
 *
 * This function returns a function that accepts an `AsyncIterable` of values to
 * transform. When called, this function returns an AsyncIterator of `Vector<T>`.
 *
 * The resulting `AsyncIterator<Vector<T>>` yields Vectors based on the
 * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
 *
 * * If `queueingStrategy` is `"count"` (or omitted), The `AsyncIterator<Vector<T>>`
 *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
 *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
 * * If `queueingStrategy` is `"bytes"`, the `AsyncIterator<Vector<T>>` will flush
 *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
 *   reaches or exceeds the supplied `highWaterMark`.
 *
 * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
 * @returns A function which accepts a JavaScript `AsyncIterable` of values
 *          to write, and returns an `AsyncIterator` that yields Vectors
 *          according to the chunking semantics defined in the `options`
 *          argument.
 * @nocollapse
 */
export declare function builderThroughAsyncIterable<T extends dtypes.DataType = any, TNull = any>(options: IterableBuilderOptions<T, TNull>): ThroughAsyncIterable<T, TNull>;
export {};
