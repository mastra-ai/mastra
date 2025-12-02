import { DataType } from './type.js';
import { Data, DataProps } from './data.js';
import { BigIntArray, TypedArray, TypedArrayDataType } from './interfaces.js';
export interface Vector<T extends DataType = any> {
    readonly TType: T['TType'];
    readonly TArray: T['TArray'];
    readonly TValue: T['TValue'];
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable
     */
    [Symbol.isConcatSpreadable]: true;
}
/**
 * Array-like data structure. Use the convenience method {@link makeVector} and {@link vectorFromArray} to create vectors.
 */
export declare class Vector<T extends DataType = any> {
    constructor(input: readonly (Data<T> | Vector<T>)[]);
    protected _offsets: number[] | Uint32Array;
    /**
     * The {@link DataType `DataType`} of this Vector.
     */
    readonly type: T;
    /**
     * The primitive {@link Data `Data`} instances for this Vector's elements.
     */
    readonly data: ReadonlyArray<Data<T>>;
    /**
     * The number of elements in this Vector.
     */
    readonly length: number;
    /**
     * The number of primitive values per Vector element.
     */
    readonly stride: number;
    /**
     * The number of child Vectors if this Vector is a nested dtype.
     */
    readonly numChildren: number;
    /**
     * The aggregate size (in bytes) of this Vector's buffers and/or child Vectors.
     */
    get byteLength(): number;
    /**
     * Whether this Vector's elements can contain null values.
     */
    get nullable(): boolean;
    /**
     * The number of null elements in this Vector.
     */
    get nullCount(): number;
    /**
     * The Array or TypedArray constructor used for the JS representation
     *  of the element's values in {@link Vector.prototype.toArray `toArray()`}.
     */
    get ArrayType(): T['ArrayType'];
    /**
     * The name that should be printed when the Vector is logged in a message.
     */
    get [Symbol.toStringTag](): string;
    /**
     * The name of this Vector.
     */
    get VectorName(): string;
    /**
     * Check whether an element is null.
     * @param index The index at which to read the validity bitmap.
     */
    isValid(index: number): boolean;
    /**
     * Get an element value by position.
     * @param index The index of the element to read.
     */
    get(index: number): T['TValue'] | null;
    /**
     * Get an element value by position.
     * @param index The index of the element to read. A negative index will count back from the last element.
     */
    at(index: number): T['TValue'] | null;
    /**
     * Set an element value by position.
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    set(index: number, value: T['TValue'] | null): void;
    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    indexOf(element: T['TValue'], offset?: number): number;
    includes(element: T['TValue'], offset?: number): boolean;
    /**
     * Iterator for the Vector's elements.
     */
    [Symbol.iterator](): IterableIterator<T['TValue'] | null>;
    /**
     * Combines two or more Vectors of the same type.
     * @param others Additional Vectors to add to the end of this Vector.
     */
    concat(...others: Vector<T>[]): Vector<T>;
    /**
     * Return a zero-copy sub-section of this Vector.
     * @param start The beginning of the specified portion of the Vector.
     * @param end The end of the specified portion of the Vector. This is exclusive of the element at the index 'end'.
     */
    slice(begin?: number, end?: number): Vector<T>;
    toJSON(): (T["TValue"] | null)[];
    /**
     * Return a JavaScript Array or TypedArray of the Vector's elements.
     *
     * @note If this Vector contains a single Data chunk and the Vector's type is a
     *  primitive numeric type corresponding to one of the JavaScript TypedArrays, this
     *  method returns a zero-copy slice of the underlying TypedArray values. If there's
     *  more than one chunk, the resulting TypedArray will be a copy of the data from each
     *  chunk's underlying TypedArray values.
     *
     * @returns An Array or TypedArray of the Vector's elements, based on the Vector's DataType.
     */
    toArray(): T['TArray'];
    /**
     * Returns a string representation of the Vector.
     *
     * @returns A string representation of the Vector.
     */
    toString(): string;
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    getChild<R extends keyof T['TChildren']>(name: R): Vector<any> | null;
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    getChildAt<R extends DataType = any>(index: number): Vector<R> | null;
    get isMemoized(): boolean;
    /**
     * Adds memoization to the Vector's {@link get} method. For dictionary
     * vectors, this method return a vector that memoizes only the dictionary
     * values.
     *
     * Memoization is very useful when decoding a value is expensive such as
     * Utf8. The memoization creates a cache of the size of the Vector and
     * therefore increases memory usage.
     *
     * @returns A new vector that memoizes calls to {@link get}.
     */
    memoize(): MemoizedVector<T>;
    /**
     * Returns a vector without memoization of the {@link get} method. If this
     * vector is not memoized, this method returns this vector.
     *
     * @returns A new vector without memoization.
     */
    unmemoize(): Vector<T>;
    protected static [Symbol.toStringTag]: string;
}
declare class MemoizedVector<T extends DataType = any> extends Vector<T> {
    constructor(vector: Vector<T>);
}
import * as dtypes from './type.js';
/**
 * Creates a Vector without data copies.
 *
 * @example
 * ```ts
 * const vector = makeVector(new Int32Array([1, 2, 3]));
 * ```
 */
export declare function makeVector<T extends TypedArray | BigIntArray>(data: T | readonly T[]): Vector<TypedArrayDataType<T>>;
export declare function makeVector<T extends DataView>(data: T | readonly T[]): Vector<dtypes.Int8>;
export declare function makeVector<T extends DataType>(data: Data<T> | readonly Data<T>[]): Vector<T>;
export declare function makeVector<T extends DataType>(data: Vector<T> | readonly Vector<T>[]): Vector<T>;
export declare function makeVector<T extends DataType>(data: DataProps<T> | readonly DataProps<T>[]): Vector<T>;
export {};
