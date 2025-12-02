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

import * as type from './type.js';
import type { Type } from './enum.js';
import type { DataType } from './type.js';
import type { Builder } from './builder.js';
import type { BuilderOptions } from './builder.js';
import type { BoolBuilder } from './builder/bool.js';
import type { NullBuilder } from './builder/null.js';
import type { DateBuilder, DateDayBuilder, DateMillisecondBuilder } from './builder/date.js';
import type { DecimalBuilder } from './builder/decimal.js';
import type { DictionaryBuilder } from './builder/dictionary.js';
import type { FixedSizeBinaryBuilder } from './builder/fixedsizebinary.js';
import type { FloatBuilder, Float16Builder, Float32Builder, Float64Builder } from './builder/float.js';
import type { IntBuilder, Int8Builder, Int16Builder, Int32Builder, Int64Builder, Uint8Builder, Uint16Builder, Uint32Builder, Uint64Builder } from './builder/int.js';
import type { TimeBuilder, TimeSecondBuilder, TimeMillisecondBuilder, TimeMicrosecondBuilder, TimeNanosecondBuilder } from './builder/time.js';
import type { TimestampBuilder, TimestampSecondBuilder, TimestampMillisecondBuilder, TimestampMicrosecondBuilder, TimestampNanosecondBuilder } from './builder/timestamp.js';
import type { IntervalBuilder, IntervalDayTimeBuilder, IntervalYearMonthBuilder } from './builder/interval.js';
import type { DurationBuilder, DurationSecondBuilder, DurationMillisecondBuilder, DurationMicrosecondBuilder, DurationNanosecondBuilder } from './builder/duration.js';
import type { Utf8Builder } from './builder/utf8.js';
import type { LargeUtf8Builder } from './builder/largeutf8.js';
import type { BinaryBuilder } from './builder/binary.js';
import type { LargeBinaryBuilder } from './builder/largebinary.js';
import type { ListBuilder } from './builder/list.js';
import type { FixedSizeListBuilder } from './builder/fixedsizelist.js';
import type { MapBuilder } from './builder/map.js';
import type { StructBuilder } from './builder/struct.js';
import type { UnionBuilder, SparseUnionBuilder, DenseUnionBuilder } from './builder/union.js';

/** @ignore */ type FloatArray = Float32Array | Float64Array;
/** @ignore */ type IntArray = Int8Array | Int16Array | Int32Array;
/** @ignore */ type UintArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray;
/** @ignore */
export type TypedArray = FloatArray | IntArray | UintArray;
/** @ignore */
export type BigIntArray = BigInt64Array | BigUint64Array;

/** @ignore */
export interface TypedArrayConstructor<T extends TypedArray> {
    readonly prototype: T;
    new(length?: number): T;
    new(array: Iterable<number>): T;
    new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    /**
      * The size in bytes of each element in the array.
      */
    readonly BYTES_PER_ELEMENT: number;
    /**
      * Returns a new array from a set of elements.
      * @param items A set of elements to include in the new array object.
      */
    of(...items: number[]): T;
    /**
      * Creates an array from an array-like or iterable object.
      * @param arrayLike An array-like or iterable object to convert to an array.
      * @param mapfn A mapping function to call on every element of the array.
      * @param thisArg Value of 'this' used to invoke the mapfn.
      */
    from(arrayLike: ArrayLike<number>, mapfn?: (v: number, k: number) => number, thisArg?: any): T;
    from<U>(arrayLike: ArrayLike<U>, mapfn: (v: U, k: number) => number, thisArg?: any): T;
}

/** @ignore */
export interface BigIntArrayConstructor<T extends BigIntArray> {
    readonly prototype: T;
    new(length?: number): T;
    new(array: Iterable<bigint>): T;
    new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    /**
      * The size in bytes of each element in the array.
      */
    readonly BYTES_PER_ELEMENT: number;
    /**
      * Returns a new array from a set of elements.
      * @param items A set of elements to include in the new array object.
      */
    of(...items: bigint[]): T;
    /**
      * Creates an array from an array-like or iterable object.
      * @param arrayLike An array-like or iterable object to convert to an array.
      * @param mapfn A mapping function to call on every element of the array.
      * @param thisArg Value of 'this' used to invoke the mapfn.
      */
    from(arrayLike: ArrayLike<bigint>, mapfn?: (v: bigint, k: number) => bigint, thisArg?: any): T;
    from<U>(arrayLike: ArrayLike<U>, mapfn: (v: U, k: number) => bigint, thisArg?: any): T;
}

/** @ignore */
export type ArrayCtor<T extends TypedArray | BigIntArray> =
    T extends TypedArray ? TypedArrayConstructor<T> :
    T extends BigIntArray ? BigIntArrayConstructor<T> :
    any;

/** @ignore */
export type BuilderCtorArgs<
    T extends BuilderType<R, any>,
    R extends DataType = any,
    TArgs extends any[] = any[],
    TCtor extends new (type: R, ...args: TArgs) => T =
    new (type: R, ...args: TArgs) => T
> = TCtor extends new (type: R, ...args: infer TArgs) => T ? TArgs : never;

/**
 * Obtain the constructor function of an instance type
 * @ignore
 */
export type ConstructorType<
    T,
    TCtor extends new (...args: any[]) => T =
    new (...args: any[]) => T
> = TCtor extends new (...args: any[]) => T ? TCtor : never;

/** @ignore */
export type BuilderCtorType<
    T extends BuilderType<R, any>,
    R extends DataType = any,
    TCtor extends new (options: BuilderOptions<R, any>) => T =
    new (options: BuilderOptions<R, any>) => T
> = TCtor extends new (options: BuilderOptions<R, any>) => T ? TCtor : never;

/** @ignore */
export type BuilderType<T extends Type | DataType = any, TNull = any> =
    T extends Type ? TypeToBuilder<T, TNull> :
    T extends DataType ? DataTypeToBuilder<T, TNull> :
    Builder<any, TNull>
    ;

/** @ignore */
export type BuilderCtor<T extends Type | DataType = any> =
    T extends Type ? BuilderCtorType<BuilderType<T>> :
    T extends DataType ? BuilderCtorType<BuilderType<T>> :
    BuilderCtorType<Builder>
    ;

/** @ignore */
export type DataTypeCtor<T extends Type | DataType = any> =
    T extends DataType ? ConstructorType<T> :
    T extends Type ? ConstructorType<TypeToDataType<T>> :
    never
    ;

/** @ignore */
export type TypedArrayDataType<T extends TypedArray | BigIntArray> =
    T extends Int8Array ? type.Int8 :
    T extends Int16Array ? type.Int16 :
    T extends Int32Array ? type.Int32 :
    T extends BigInt64Array ? type.Int64 :
    T extends Uint8Array ? type.Uint8 :
    T extends Uint8ClampedArray ? type.Uint8 :
    T extends Uint16Array ? type.Uint16 :
    T extends Uint32Array ? type.Uint32 :
    T extends BigUint64Array ? type.Uint64 :
    T extends Float32Array ? type.Float32 :
    T extends Float64Array ? type.Float64 :
    never;

/** @ignore */
export type JavaScriptDataType<T> = JavaScriptArrayDataType<T[]>;

/** @ignore */
export type JavaScriptArrayDataType<T extends readonly unknown[]> =
    T extends readonly (null | undefined)[] ? type.Null :
    T extends readonly (null | undefined | boolean)[] ? type.Bool :
    T extends readonly (null | undefined | string)[] ? type.Dictionary<type.Utf8, type.Int32> :
    T extends readonly (null | undefined | Date)[] ? type.Date_ :
    T extends readonly (null | undefined | bigint)[] ? type.Int64 :
    T extends readonly (null | undefined | number)[] ? type.Float64 :
    T extends readonly (null | undefined | readonly (infer U)[])[] ? type.List<JavaScriptDataType<U>> :
    T extends readonly (null | undefined | Record<string, unknown>)[] ? T extends readonly (null | undefined | infer U)[] ? type.Struct<{ [P in keyof U]: JavaScriptDataType<U[P]> }> : never :
    never;

/** @ignore */
export type ArrayDataType<T> =
    T extends TypedArray | BigIntArray ? TypedArrayDataType<T> :
    T extends readonly unknown[] ? JavaScriptArrayDataType<T> :
    never;

/** @ignore */
export type TypeToDataType<T extends Type> = {
    [key: number]: type.DataType;
    [Type.Null]: type.Null;
    [Type.Bool]: type.Bool;
    [Type.Int]: type.Int;
    [Type.Int16]: type.Int16;
    [Type.Int32]: type.Int32;
    [Type.Int64]: type.Int64;
    [Type.Uint8]: type.Uint8;
    [Type.Uint16]: type.Uint16;
    [Type.Uint32]: type.Uint32;
    [Type.Uint64]: type.Uint64;
    [Type.Int8]: type.Int8;
    [Type.Float16]: type.Float16;
    [Type.Float32]: type.Float32;
    [Type.Float64]: type.Float64;
    [Type.Float]: type.Float;
    [Type.Utf8]: type.Utf8;
    [Type.LargeUtf8]: type.LargeUtf8;
    [Type.Binary]: type.Binary;
    [Type.LargeBinary]: type.LargeBinary;
    [Type.FixedSizeBinary]: type.FixedSizeBinary;
    [Type.Date]: type.Date_;
    [Type.DateDay]: type.DateDay;
    [Type.DateMillisecond]: type.DateMillisecond;
    [Type.Timestamp]: type.Timestamp;
    [Type.TimestampSecond]: type.TimestampSecond;
    [Type.TimestampMillisecond]: type.TimestampMillisecond;
    [Type.TimestampMicrosecond]: type.TimestampMicrosecond;
    [Type.TimestampNanosecond]: type.TimestampNanosecond;
    [Type.Time]: type.Time;
    [Type.TimeSecond]: type.TimeSecond;
    [Type.TimeMillisecond]: type.TimeMillisecond;
    [Type.TimeMicrosecond]: type.TimeMicrosecond;
    [Type.TimeNanosecond]: type.TimeNanosecond;
    [Type.Decimal]: type.Decimal;
    [Type.Union]: type.Union;
    [Type.DenseUnion]: type.DenseUnion;
    [Type.SparseUnion]: type.SparseUnion;
    [Type.Interval]: type.Interval;
    [Type.IntervalDayTime]: type.IntervalDayTime;
    [Type.IntervalYearMonth]: type.IntervalYearMonth;
    [Type.Duration]: type.Duration;
    [Type.DurationSecond]: type.DurationSecond;
    [Type.DurationMillisecond]: type.DurationMillisecond;
    [Type.DurationMicrosecond]: type.DurationMicrosecond;
    [Type.DurationNanosecond]: type.DurationNanosecond;
    [Type.Map]: type.Map_;
    [Type.List]: type.List;
    [Type.Struct]: type.Struct;
    [Type.Dictionary]: type.Dictionary;
    [Type.FixedSizeList]: type.FixedSizeList;
}[T];

/** @ignore */
type TypeToBuilder<T extends Type = any, TNull = any> = {
    [key: number]: Builder;
    [Type.Null]: NullBuilder<TNull>;
    [Type.Bool]: BoolBuilder<TNull>;
    [Type.Int8]: Int8Builder<TNull>;
    [Type.Int16]: Int16Builder<TNull>;
    [Type.Int32]: Int32Builder<TNull>;
    [Type.Int64]: Int64Builder<TNull>;
    [Type.Uint8]: Uint8Builder<TNull>;
    [Type.Uint16]: Uint16Builder<TNull>;
    [Type.Uint32]: Uint32Builder<TNull>;
    [Type.Uint64]: Uint64Builder<TNull>;
    [Type.Int]: IntBuilder<any, TNull>;
    [Type.Float16]: Float16Builder<TNull>;
    [Type.Float32]: Float32Builder<TNull>;
    [Type.Float64]: Float64Builder<TNull>;
    [Type.Float]: FloatBuilder<any, TNull>;
    [Type.Utf8]: Utf8Builder<TNull>;
    [Type.LargeUtf8]: LargeUtf8Builder<TNull>;
    [Type.Binary]: BinaryBuilder<TNull>;
    [Type.LargeBinary]: LargeBinaryBuilder<TNull>;
    [Type.FixedSizeBinary]: FixedSizeBinaryBuilder<TNull>;
    [Type.Date]: DateBuilder<any, TNull>;
    [Type.DateDay]: DateDayBuilder<TNull>;
    [Type.DateMillisecond]: DateMillisecondBuilder<TNull>;
    [Type.Timestamp]: TimestampBuilder<any, TNull>;
    [Type.TimestampSecond]: TimestampSecondBuilder<TNull>;
    [Type.TimestampMillisecond]: TimestampMillisecondBuilder<TNull>;
    [Type.TimestampMicrosecond]: TimestampMicrosecondBuilder<TNull>;
    [Type.TimestampNanosecond]: TimestampNanosecondBuilder<TNull>;
    [Type.Time]: TimeBuilder<any, TNull>;
    [Type.TimeSecond]: TimeSecondBuilder<TNull>;
    [Type.TimeMillisecond]: TimeMillisecondBuilder<TNull>;
    [Type.TimeMicrosecond]: TimeMicrosecondBuilder<TNull>;
    [Type.TimeNanosecond]: TimeNanosecondBuilder<TNull>;
    [Type.Decimal]: DecimalBuilder<TNull>;
    [Type.Union]: UnionBuilder<any, TNull>;
    [Type.DenseUnion]: DenseUnionBuilder<any, TNull>;
    [Type.SparseUnion]: SparseUnionBuilder<any, TNull>;
    [Type.Interval]: IntervalBuilder<any, TNull>;
    [Type.IntervalDayTime]: IntervalDayTimeBuilder<TNull>;
    [Type.IntervalYearMonth]: IntervalYearMonthBuilder<TNull>;
    [Type.Duration]: DurationBuilder<any, TNull>;
    [Type.DurationSecond]: DurationBuilder<any, TNull>;
    [Type.DurationMillisecond]: DurationMillisecondBuilder<TNull>;
    [Type.DurationMicrosecond]: DurationMicrosecondBuilder<TNull>;
    [Type.DurationNanosecond]: DurationNanosecondBuilder<TNull>;
    [Type.Map]: MapBuilder<any, any, TNull>;
    [Type.List]: ListBuilder<any, TNull>;
    [Type.Struct]: StructBuilder<any, TNull>;
    [Type.Dictionary]: DictionaryBuilder<any, TNull>;
    [Type.FixedSizeList]: FixedSizeListBuilder<any, TNull>;
}[T];

/** @ignore */
type DataTypeToBuilder<T extends DataType = any, TNull = any> = {
    [key: number]: Builder<any, TNull>;
    [Type.Null]: T extends type.Null ? NullBuilder<TNull> : never;
    [Type.Bool]: T extends type.Bool ? BoolBuilder<TNull> : never;
    [Type.Int8]: T extends type.Int8 ? Int8Builder<TNull> : never;
    [Type.Int16]: T extends type.Int16 ? Int16Builder<TNull> : never;
    [Type.Int32]: T extends type.Int32 ? Int32Builder<TNull> : never;
    [Type.Int64]: T extends type.Int64 ? Int64Builder<TNull> : never;
    [Type.Uint8]: T extends type.Uint8 ? Uint8Builder<TNull> : never;
    [Type.Uint16]: T extends type.Uint16 ? Uint16Builder<TNull> : never;
    [Type.Uint32]: T extends type.Uint32 ? Uint32Builder<TNull> : never;
    [Type.Uint64]: T extends type.Uint64 ? Uint64Builder<TNull> : never;
    [Type.Int]: T extends type.Int ? IntBuilder<T, TNull> : never;
    [Type.Float16]: T extends type.Float16 ? Float16Builder<TNull> : never;
    [Type.Float32]: T extends type.Float32 ? Float32Builder<TNull> : never;
    [Type.Float64]: T extends type.Float64 ? Float64Builder<TNull> : never;
    [Type.Float]: T extends type.Float ? FloatBuilder<T, TNull> : never;
    [Type.Utf8]: T extends type.Utf8 ? Utf8Builder<TNull> : never;
    [Type.LargeUtf8]: T extends type.LargeUtf8 ? LargeUtf8Builder<TNull> : never;
    [Type.Binary]: T extends type.Binary ? BinaryBuilder<TNull> : never;
    [Type.LargeBinary]: T extends type.LargeBinary ? LargeBinaryBuilder<TNull> : never;
    [Type.FixedSizeBinary]: T extends type.FixedSizeBinary ? FixedSizeBinaryBuilder<TNull> : never;
    [Type.Date]: T extends type.Date_ ? DateBuilder<T, TNull> : never;
    [Type.DateDay]: T extends type.DateDay ? DateDayBuilder<TNull> : never;
    [Type.DateMillisecond]: T extends type.DateMillisecond ? DateMillisecondBuilder<TNull> : never;
    [Type.Timestamp]: T extends type.Timestamp ? TimestampBuilder<T, TNull> : never;
    [Type.TimestampSecond]: T extends type.TimestampSecond ? TimestampSecondBuilder<TNull> : never;
    [Type.TimestampMillisecond]: T extends type.TimestampMillisecond ? TimestampMillisecondBuilder<TNull> : never;
    [Type.TimestampMicrosecond]: T extends type.TimestampMicrosecond ? TimestampMicrosecondBuilder<TNull> : never;
    [Type.TimestampNanosecond]: T extends type.TimestampNanosecond ? TimestampNanosecondBuilder<TNull> : never;
    [Type.Time]: T extends type.Time ? TimeBuilder<T, TNull> : never;
    [Type.TimeSecond]: T extends type.TimeSecond ? TimeSecondBuilder<TNull> : never;
    [Type.TimeMillisecond]: T extends type.TimeMillisecond ? TimeMillisecondBuilder<TNull> : never;
    [Type.TimeMicrosecond]: T extends type.TimeMicrosecond ? TimeMicrosecondBuilder<TNull> : never;
    [Type.TimeNanosecond]: T extends type.TimeNanosecond ? TimeNanosecondBuilder<TNull> : never;
    [Type.Decimal]: T extends type.Decimal ? DecimalBuilder<TNull> : never;
    [Type.Union]: T extends type.Union ? UnionBuilder<T, TNull> : never;
    [Type.DenseUnion]: T extends type.DenseUnion ? DenseUnionBuilder<T, TNull> : never;
    [Type.SparseUnion]: T extends type.SparseUnion ? SparseUnionBuilder<T, TNull> : never;
    [Type.Interval]: T extends type.Interval ? IntervalBuilder<T, TNull> : never;
    [Type.IntervalDayTime]: T extends type.IntervalDayTime ? IntervalDayTimeBuilder<TNull> : never;
    [Type.IntervalYearMonth]: T extends type.IntervalYearMonth ? IntervalYearMonthBuilder<TNull> : never;
    [Type.Duration]: T extends type.Duration ? DurationBuilder<T, TNull> : never;
    [Type.DurationSecond]: T extends type.DurationSecond ? DurationSecondBuilder<TNull> : never;
    [Type.DurationMillisecond]: T extends type.DurationMillisecond ? DurationMillisecondBuilder<TNull> : never;
    [Type.DurationMicrosecond]: T extends type.DurationMicrosecond ? DurationMicrosecondBuilder<TNull> : never;
    [Type.DurationNanosecond]: T extends type.DurationNanosecond ? DurationNanosecondBuilder<TNull> : never;
    [Type.Map]: T extends type.Map_ ? MapBuilder<T['keyType'], T['valueType'], TNull> : never;
    [Type.List]: T extends type.List ? ListBuilder<T['valueType'], TNull> : never;
    [Type.Struct]: T extends type.Struct ? StructBuilder<T['dataTypes'], TNull> : never;
    [Type.Dictionary]: T extends type.Dictionary ? DictionaryBuilder<T, TNull> : never;
    [Type.FixedSizeList]: T extends type.FixedSizeList ? FixedSizeListBuilder<T['valueType'], TNull> : never;
}[T['TType']];
