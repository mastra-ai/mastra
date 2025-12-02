import { Data } from './data.js';
import { Vector } from './vector.js';
import { Schema } from './schema.js';
import { DataType, Struct, TypeMap } from './type.js';
import { DataProps } from './data.js';
import { ArrayDataType, BigIntArray, TypedArray, TypedArrayDataType } from './interfaces.js';
import { RecordBatch } from './recordbatch.js';
/** @ignore */
export interface Table<T extends TypeMap = any> {
    readonly TType: Struct<T>;
    readonly TArray: Struct<T>['TArray'];
    readonly TValue: Struct<T>['TValue'];
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable
     */
    [Symbol.isConcatSpreadable]: true;
}
/**
 * Tables are collections of {@link Vector}s and have a {@link Schema}. Use the convenience methods {@link makeTable}
 * or {@link tableFromArrays} to create a table in JavaScript. To create a table from the IPC format, use
 * {@link tableFromIPC}.
 */
export declare class Table<T extends TypeMap = any> {
    constructor();
    constructor(batches: Iterable<RecordBatch<T>>);
    constructor(...batches: readonly RecordBatch<T>[]);
    constructor(...columns: {
        [P in keyof T]: Vector<T[P]>;
    }[]);
    constructor(...columns: {
        [P in keyof T]: Data<T[P]> | DataProps<T[P]>;
    }[]);
    constructor(schema: Schema<T>, ...columns: {
        [P in keyof T]: Vector<T[P]>;
    }[]);
    constructor(schema: Schema<T>, ...columns: {
        [P in keyof T]: Data<T[P]> | DataProps<T[P]>;
    }[]);
    constructor(schema: Schema<T>, data?: RecordBatch<T> | RecordBatch<T>[]);
    constructor(schema: Schema<T>, data?: RecordBatch<T> | RecordBatch<T>[], offsets?: Uint32Array);
    protected _offsets: Uint32Array | number[];
    protected _nullCount: number;
    readonly schema: Schema<T>;
    /**
     * The contiguous {@link RecordBatch `RecordBatch`} chunks of the Table rows.
     */
    readonly batches: RecordBatch<T>[];
    /**
     * The contiguous {@link RecordBatch `RecordBatch`} chunks of the Table rows.
     */
    get data(): Data<Struct<T>>[];
    /**
     * The number of columns in this Table.
     */
    get numCols(): number;
    /**
     * The number of rows in this Table.
     */
    get numRows(): number;
    /**
     * The number of null rows in this Table.
     */
    get nullCount(): number;
    /**
     * Check whether an element is null.
     *
     * @param index The index at which to read the validity bitmap.
     */
    isValid(index: number): boolean;
    /**
     * Get an element value by position.
     *
     * @param index The index of the element to read.
     */
    get(index: number): Struct<T>['TValue'] | null;
    /**
      * Get an element value by position.
      * @param index The index of the element to read. A negative index will count back from the last element.
      */
    at(index: number): Struct<T>['TValue'] | null;
    /**
     * Set an element value by position.
     *
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    set(index: number, value: Struct<T>['TValue'] | null): void;
    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     *
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    indexOf(element: Struct<T>['TValue'], offset?: number): number;
    /**
     * Iterator for rows in this Table.
     */
    [Symbol.iterator](): IterableIterator<any>;
    /**
     * Return a JavaScript Array of the Table rows.
     *
     * @returns An Array of Table rows.
     */
    toArray(): any[];
    /**
     * Returns a string representation of the Table rows.
     *
     * @returns A string representation of the Table rows.
     */
    toString(): string;
    /**
     * Combines two or more Tables of the same schema.
     *
     * @param others Additional Tables to add to the end of this Tables.
     */
    concat(...others: Table<T>[]): Table<T>;
    /**
     * Return a zero-copy sub-section of this Table.
     *
     * @param begin The beginning of the specified portion of the Table.
     * @param end The end of the specified portion of the Table. This is exclusive of the element at the index 'end'.
     */
    slice(begin?: number, end?: number): Table<T>;
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     *
     * @param name The name of the child to retrieve.
     */
    getChild<P extends keyof T>(name: P): Vector<T[P]> | null;
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     *
     * @param index The index of the child to retrieve.
     */
    getChildAt<R extends T[keyof T] = any>(index: number): Vector<R> | null;
    /**
     * Sets a child Vector by name.
     *
     * @param name The name of the child to overwrite.
     * @returns A new Table with the supplied child for the specified name.
     */
    setChild<P extends keyof T, R extends DataType>(name: P, child: Vector<R>): Table<T & { [K in P]: R; }>;
    /**
     * Sets a child Vector by index.
     *
     * @param index The index of the child to overwrite.
     * @returns A new Table with the supplied child at the specified index.
     */
    setChildAt(index: number, child?: null): Table;
    setChildAt<R extends DataType = any>(index: number, child: Vector<R>): Table;
    /**
     * Construct a new Table containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new Table of columns matching the specified names.
     */
    select<K extends keyof T = any>(columnNames: K[]): Table<{
        [key: string]: any;
    }>;
    /**
     * Construct a new Table containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new Table of columns at the specified indices.
     */
    selectAt<K extends T[keyof T] = any>(columnIndices: number[]): Table<{
        [key: string]: K;
    }>;
    assign<R extends TypeMap = any>(other: Table<R>): Table<T & R>;
    protected static [Symbol.toStringTag]: string;
}
/**
 * Creates a new Table from an object of typed arrays.
 *
*  @example
 * ```ts
 * const table = makeTable({
 *   a: new Int8Array([1, 2, 3]),
 * })
 * ```
 *
 * @param input Input an object of typed arrays.
 * @returns A new Table.
 */
export declare function makeTable<I extends Record<string | number | symbol, TypedArray>>(input: I): Table<{
    [P in keyof I]: TypedArrayDataType<I[P]>;
}>;
/**
 * Creates a new Table from an object of typed arrays or JavaScript arrays.
 *
 *  @example
 * ```ts
 * const table = tableFromArrays({
 *   a: [1, 2, 3],
 *   b: new Int8Array([1, 2, 3]),
 * })
 * ```
 *
 * @param input Input an object of typed arrays or JavaScript arrays.
 * @returns A new Table.
 */
export declare function tableFromArrays<I extends Record<string | number | symbol, TypedArray | BigIntArray | readonly unknown[]>>(input: I): Table<{
    [P in keyof I]: ArrayDataType<I[P]>;
}>;
