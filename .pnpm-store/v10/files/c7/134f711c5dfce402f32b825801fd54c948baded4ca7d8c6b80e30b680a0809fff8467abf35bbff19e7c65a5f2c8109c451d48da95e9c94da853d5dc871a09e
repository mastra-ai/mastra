/**
 * A interface recognizable as a numeric value that stores the underlying number
 * as a string.
 *
 * Intended to be a deserialization target for the DynamoDB Document Client when
 * the `wrapNumbers` flag is set. This allows for numeric values that lose
 * precision when converted to JavaScript's `number` type.
 */
export interface NumberValue {
    readonly value: string;
}
/**
 * @public
 */
export type NativeAttributeValue = NativeScalarAttributeValue | {
    [key: string]: NativeAttributeValue;
} | NativeAttributeValue[] | Set<number | bigint | NumberValue | string | NativeAttributeBinary | undefined> | InstanceType<{
    new (...args: any[]): any;
}>;
/**
 * @public
 */
export type NativeScalarAttributeValue = null | undefined | boolean | number | NumberValue | bigint | NativeAttributeBinary | string;
/**
 * Declare File in case DOM is not added to the tsconfig lib causing
 * File interface is not defined. For developers with DOM lib added,
 * the File interface will be merged correctly.
 */
declare global {
    interface File {
    }
}
type IfDefined<T> = {} extends T ? never : T;
/**
 * @public
 */
export type NativeAttributeBinary = ArrayBuffer | IfDefined<Blob> | IfDefined<Buffer> | DataView | IfDefined<File> | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;
export {};
