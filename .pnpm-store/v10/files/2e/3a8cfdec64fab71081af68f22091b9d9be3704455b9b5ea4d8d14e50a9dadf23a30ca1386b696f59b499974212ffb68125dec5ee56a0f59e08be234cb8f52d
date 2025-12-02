import { Data } from './data.js';
import { Table } from './table.js';
import { Vector } from './vector.js';
import { Schema } from './schema.js';
import { DataType, Struct, TypeMap } from './type.js';
/** @ignore */
export interface RecordBatch<T extends TypeMap = any> {
    readonly TType: Struct<T>;
    readonly TArray: Struct<T>['TArray'];
    readonly TValue: Struct<T>['TValue'];
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable
     */
    [Symbol.isConcatSpreadable]: true;
}
/** @ignore */
export declare class RecordBatch<T extends TypeMap = any> {
    constructor(columns: {
        [P in keyof T]: Data<T[P]>;
    });
    constructor(schema: Schema<T>, data?: Data<Struct<T>>);
    protected _dictionaries?: Map<number, Vector>;
    readonly schema: Schema<T>;
    readonly data: Data<Struct<T>>;
    get dictionaries(): Map<number, Vector<any>>;
    /**
     * The number of columns in this RecordBatch.
     */
    get numCols(): number;
    /**
     * The number of rows in this RecordBatch.
     */
    get numRows(): number;
    /**
     * The number of null rows in this RecordBatch.
     */
    get nullCount(): number;
    /**
     * Check whether an row is null.
     * @param index The index at which to read the validity bitmap.
     */
    isValid(index: number): boolean;
    /**
     * Get a row by position.
     * @param index The index of the row to read.
     */
    get(index: number): import("./Arrow.js").StructRowProxy<T> | null;
    /**
      * Get a row value by position.
      * @param index The index of the row to read. A negative index will count back from the last row.
      */
    at(index: number): import("./Arrow.js").StructRowProxy<T> | null;
    /**
     * Set a row by position.
     * @param index The index of the row to write.
     * @param value The value to set.
     */
    set(index: number, value: Struct<T>['TValue']): void;
    /**
     * Retrieve the index of the first occurrence of a row in an RecordBatch.
     * @param element The row to locate in the RecordBatch.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    indexOf(element: Struct<T>['TValue'], offset?: number): number;
    /**
     * Iterator for rows in this RecordBatch.
     */
    [Symbol.iterator](): IterableIterator<import("./Arrow.js").StructRowProxy<T>>;
    /**
     * Return a JavaScript Array of the RecordBatch rows.
     * @returns An Array of RecordBatch rows.
     */
    toArray(): import("./Arrow.js").StructRowProxy<T>[];
    /**
     * Combines two or more RecordBatch of the same schema.
     * @param others Additional RecordBatch to add to the end of this RecordBatch.
     */
    concat(...others: RecordBatch<T>[]): Table<T>;
    /**
     * Return a zero-copy sub-section of this RecordBatch.
     * @param start The beginning of the specified portion of the RecordBatch.
     * @param end The end of the specified portion of the RecordBatch. This is exclusive of the row at the index 'end'.
     */
    slice(begin?: number, end?: number): RecordBatch<T>;
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    getChild<P extends keyof T>(name: P): Vector<T[P]> | null;
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    getChildAt<R extends T[keyof T] = any>(index: number): Vector<R> | null;
    /**
     * Sets a child Vector by name.
     * @param name The name of the child to overwrite.
     * @returns A new RecordBatch with the new child for the specified name.
     */
    setChild<P extends keyof T, R extends DataType>(name: P, child: Vector<R>): RecordBatch<T & { [K in P]: R; }>;
    /**
     * Sets a child Vector by index.
     * @param index The index of the child to overwrite.
     * @returns A new RecordBatch with the new child at the specified index.
     */
    setChildAt(index: number, child?: null): RecordBatch;
    setChildAt<R extends DataType = any>(index: number, child: Vector<R>): RecordBatch;
    /**
     * Construct a new RecordBatch containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new RecordBatch of columns matching the specified names.
     */
    select<K extends keyof T = any>(columnNames: K[]): RecordBatch<{ [P in K]: T[P]; }>;
    /**
     * Construct a new RecordBatch containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new RecordBatch of columns matching at the specified indices.
     */
    selectAt<K extends T = any>(columnIndices: number[]): RecordBatch<{ [P in keyof K]: K[P]; }>;
    protected static [Symbol.toStringTag]: string;
}
/**
 * An internal class used by the `RecordBatchReader` and `RecordBatchWriter`
 * implementations to differentiate between a stream with valid zero-length
 * RecordBatches, and a stream with a Schema message, but no RecordBatches.
 * @see https://github.com/apache/arrow/pull/4373
 * @ignore
 * @private
 */
export declare class _InternalEmptyPlaceholderRecordBatch<T extends TypeMap = any> extends RecordBatch<T> {
    constructor(schema: Schema<T>);
}
