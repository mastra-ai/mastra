export interface NumberValue {
  readonly value: string;
}
export type NativeAttributeValue =
  | NativeScalarAttributeValue
  | {
      [key: string]: NativeAttributeValue;
    }
  | NativeAttributeValue[]
  | Set<
      number | bigint | NumberValue | string | NativeAttributeBinary | undefined
    >
  | InstanceType<{
      new (...args: any[]): any;
    }>;
export type NativeScalarAttributeValue =
  | null
  | undefined
  | boolean
  | number
  | NumberValue
  | bigint
  | NativeAttributeBinary
  | string;
declare global {
  interface File {}
}
type IfDefined<T> = {} extends T ? never : T;
export type NativeAttributeBinary =
  | ArrayBuffer
  | IfDefined<Blob>
  | IfDefined<Buffer>
  | DataView
  | IfDefined<File>
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;
export {};
