import { TypedArray, BigIntArray, ArrayCtor } from '../interfaces.js';
import { DataType } from '../type.js';
/** @ignore */
export declare class BufferBuilder<T extends TypedArray | BigIntArray> {
    constructor(bufferType: ArrayCtor<T>, initialSize?: number, stride?: number);
    buffer: T;
    length: number;
    readonly stride: number;
    readonly ArrayType: ArrayCtor<T>;
    readonly BYTES_PER_ELEMENT: number;
    get byteLength(): number;
    get reservedLength(): number;
    get reservedByteLength(): number;
    set(index: number, value: T[0]): this;
    append(value: T[0]): this;
    reserve(extra: number): this;
    flush(length?: number): T;
    clear(): this;
    protected _resize(newLength: number): T;
}
/** @ignore */
export declare class DataBufferBuilder<T extends TypedArray | BigIntArray> extends BufferBuilder<T> {
    last(): T[0];
    get(index: number): T[0];
    set(index: number, value: T[0]): this;
}
/** @ignore */
export declare class BitmapBufferBuilder extends DataBufferBuilder<Uint8Array> {
    constructor();
    numValid: number;
    get numInvalid(): number;
    get(idx: number): number;
    set(idx: number, val: number): this;
    clear(): this;
}
/** @ignore */
export declare class OffsetsBufferBuilder<T extends DataType> extends DataBufferBuilder<T['TOffsetArray']> {
    constructor(type: T);
    append(value: T['TOffsetArray'][0]): this;
    set(index: number, value: T['TOffsetArray'][0]): this;
    flush(length?: number): T["TOffsetArray"];
}
