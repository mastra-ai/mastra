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

import { Field } from './schema.js';
import { Vector } from './vector.js';
import { MapRow } from './row/map.js';
import { StructRow, StructRowProxy } from './row/struct.js';
import { ArrayCtor, BigIntArrayConstructor, TypedArrayConstructor } from './interfaces.js';
import { bigIntToNumber } from './util/bigint.js';

import {
    Type,
    Precision, UnionMode,
    DateUnit, TimeUnit, IntervalUnit
} from './enum.js';

/** @ignore */
export type TimeBitWidth = 32 | 64;
/** @ignore */
export type IntBitWidth = 8 | 16 | 32 | 64;
/** @ignore */
export type IsSigned = { 'true': true; 'false': false };

export interface DataType<TType extends Type = Type, TChildren extends TypeMap = any> {
    readonly TType: TType;
    readonly TArray: any;
    readonly TOffsetArray: any;
    readonly TValue: any;
    readonly TChildren: TChildren;
    readonly ArrayType: any;
    readonly OffsetArrayType: ArrayCtor<Int32Array | BigInt64Array>;
    readonly children: Field<TChildren[keyof TChildren]>[];
}

/**
 * An abstract base class for classes that encapsulate metadata about each of
 * the logical types that Arrow can represent.
 */
export abstract class DataType<TType extends Type = Type, TChildren extends TypeMap = any> {

    declare public [Symbol.toStringTag]: string;

    /** @nocollapse */ static isNull(x: any): x is Null { return x?.typeId === Type.Null; }
    /** @nocollapse */ static isInt(x: any): x is Int_ { return x?.typeId === Type.Int; }
    /** @nocollapse */ static isFloat(x: any): x is Float { return x?.typeId === Type.Float; }
    /** @nocollapse */ static isBinary(x: any): x is Binary { return x?.typeId === Type.Binary; }
    /** @nocollapse */ static isLargeBinary(x: any): x is LargeBinary { return x?.typeId === Type.LargeBinary; }
    /** @nocollapse */ static isUtf8(x: any): x is Utf8 { return x?.typeId === Type.Utf8; }
    /** @nocollapse */ static isLargeUtf8(x: any): x is LargeUtf8 { return x?.typeId === Type.LargeUtf8; }
    /** @nocollapse */ static isBool(x: any): x is Bool { return x?.typeId === Type.Bool; }
    /** @nocollapse */ static isDecimal(x: any): x is Decimal { return x?.typeId === Type.Decimal; }
    /** @nocollapse */ static isDate(x: any): x is Date_ { return x?.typeId === Type.Date; }
    /** @nocollapse */ static isTime(x: any): x is Time_ { return x?.typeId === Type.Time; }
    /** @nocollapse */ static isTimestamp(x: any): x is Timestamp_ { return x?.typeId === Type.Timestamp; }
    /** @nocollapse */ static isInterval(x: any): x is Interval_ { return x?.typeId === Type.Interval; }
    /** @nocollapse */ static isDuration(x: any): x is Duration { return x?.typeId === Type.Duration; }
    /** @nocollapse */ static isList(x: any): x is List { return x?.typeId === Type.List; }
    /** @nocollapse */ static isStruct(x: any): x is Struct { return x?.typeId === Type.Struct; }
    /** @nocollapse */ static isUnion(x: any): x is Union_ { return x?.typeId === Type.Union; }
    /** @nocollapse */ static isFixedSizeBinary(x: any): x is FixedSizeBinary { return x?.typeId === Type.FixedSizeBinary; }
    /** @nocollapse */ static isFixedSizeList(x: any): x is FixedSizeList { return x?.typeId === Type.FixedSizeList; }
    /** @nocollapse */ static isMap(x: any): x is Map_ { return x?.typeId === Type.Map; }
    /** @nocollapse */ static isDictionary(x: any): x is Dictionary { return x?.typeId === Type.Dictionary; }

    /** @nocollapse */ static isDenseUnion(x: any): x is DenseUnion { return DataType.isUnion(x) && x.mode === UnionMode.Dense; }
    /** @nocollapse */ static isSparseUnion(x: any): x is SparseUnion { return DataType.isUnion(x) && x.mode === UnionMode.Sparse; }

    declare public readonly typeId: TType;

    constructor(typeId: TType) {
        this.typeId = typeId;
    }

    protected static [Symbol.toStringTag] = ((proto: DataType) => {
        (<any>proto).children = null;
        (<any>proto).ArrayType = Array;
        (<any>proto).OffsetArrayType = Int32Array;
        return proto[Symbol.toStringTag] = 'DataType';
    })(DataType.prototype);
}

/** @ignore */
export interface Null extends DataType<Type.Null> { TArray: void; TValue: null }
/** @ignore */
export class Null extends DataType<Type.Null> {
    constructor() {
        super(Type.Null);
    }
    public toString() { return `Null`; }
    protected static [Symbol.toStringTag] = ((proto: Null) => proto[Symbol.toStringTag] = 'Null')(Null.prototype);
}

/** @ignore */
type Ints = Type.Int | Type.Int8 | Type.Int16 | Type.Int32 | Type.Int64 | Type.Uint8 | Type.Uint16 | Type.Uint32 | Type.Uint64;
/** @ignore */
type IType = {
    [Type.Int]: { bitWidth: IntBitWidth; isSigned: true | false; TArray: IntArray; TValue: number | bigint };
    [Type.Int8]: { bitWidth: 8; isSigned: true; TArray: Int8Array; TValue: number };
    [Type.Int16]: { bitWidth: 16; isSigned: true; TArray: Int16Array; TValue: number };
    [Type.Int32]: { bitWidth: 32; isSigned: true; TArray: Int32Array; TValue: number };
    [Type.Int64]: { bitWidth: 64; isSigned: true; TArray: BigInt64Array; TValue: bigint };
    [Type.Uint8]: { bitWidth: 8; isSigned: false; TArray: Uint8Array; TValue: number };
    [Type.Uint16]: { bitWidth: 16; isSigned: false; TArray: Uint16Array; TValue: number };
    [Type.Uint32]: { bitWidth: 32; isSigned: false; TArray: Uint32Array; TValue: number };
    [Type.Uint64]: { bitWidth: 64; isSigned: false; TArray: BigUint64Array; TValue: bigint };
};

/** @ignore */
interface Int_<T extends Ints = Ints> extends DataType<T> { TArray: IType[T]['TArray']; TValue: IType[T]['TValue'] }
/** @ignore */
class Int_<T extends Ints = Ints> extends DataType<T> {
    constructor(public readonly isSigned: IType[T]['isSigned'],
        public readonly bitWidth: IType[T]['bitWidth']) {
        super(Type.Int as T);
    }
    public get ArrayType() {
        switch (this.bitWidth) {
            case 8: return this.isSigned ? Int8Array : Uint8Array;
            case 16: return this.isSigned ? Int16Array : Uint16Array;
            case 32: return this.isSigned ? Int32Array : Uint32Array;
            case 64: return this.isSigned ? BigInt64Array : BigUint64Array;
        }
        throw new Error(`Unrecognized ${this[Symbol.toStringTag]} type`);
    }
    public toString() { return `${this.isSigned ? `I` : `Ui`}nt${this.bitWidth}`; }
    protected static [Symbol.toStringTag] = ((proto: Int_) => {
        (<any>proto).isSigned = null;
        (<any>proto).bitWidth = null;
        return proto[Symbol.toStringTag] = 'Int';
    })(Int_.prototype);
}

export { Int_ as Int };

/** @ignore */
export class Int8 extends Int_<Type.Int8> {
    constructor() { super(true, 8); }
    public get ArrayType() { return Int8Array; }
}
/** @ignore */
export class Int16 extends Int_<Type.Int16> {
    constructor() { super(true, 16); }
    public get ArrayType() { return Int16Array; }
}
/** @ignore */
export class Int32 extends Int_<Type.Int32> {
    constructor() { super(true, 32); }
    public get ArrayType() { return Int32Array; }
}
/** @ignore */
export class Int64 extends Int_<Type.Int64> {
    constructor() { super(true, 64); }
    public get ArrayType() { return BigInt64Array; }
}
/** @ignore */
export class Uint8 extends Int_<Type.Uint8> {
    constructor() { super(false, 8); }
    public get ArrayType() { return Uint8Array; }
}
/** @ignore */
export class Uint16 extends Int_<Type.Uint16> {
    constructor() { super(false, 16); }
    public get ArrayType() { return Uint16Array; }
}
/** @ignore */
export class Uint32 extends Int_<Type.Uint32> {
    constructor() { super(false, 32); }
    public get ArrayType() { return Uint32Array; }
}
/** @ignore */
export class Uint64 extends Int_<Type.Uint64> {
    constructor() { super(false, 64); }
    public get ArrayType() { return BigUint64Array; }
}

Object.defineProperty(Int8.prototype, 'ArrayType', { value: Int8Array });
Object.defineProperty(Int16.prototype, 'ArrayType', { value: Int16Array });
Object.defineProperty(Int32.prototype, 'ArrayType', { value: Int32Array });
Object.defineProperty(Int64.prototype, 'ArrayType', { value: BigInt64Array });
Object.defineProperty(Uint8.prototype, 'ArrayType', { value: Uint8Array });
Object.defineProperty(Uint16.prototype, 'ArrayType', { value: Uint16Array });
Object.defineProperty(Uint32.prototype, 'ArrayType', { value: Uint32Array });
Object.defineProperty(Uint64.prototype, 'ArrayType', { value: BigUint64Array });

/** @ignore */
type Floats = Type.Float | Type.Float16 | Type.Float32 | Type.Float64;
/** @ignore */
type FType = {
    [Type.Float]: { precision: Precision; TArray: FloatArray; TValue: number };
    [Type.Float16]: { precision: Precision.HALF; TArray: Uint16Array; TValue: number };
    [Type.Float32]: { precision: Precision.SINGLE; TArray: Float32Array; TValue: number };
    [Type.Float64]: { precision: Precision.DOUBLE; TArray: Float64Array; TValue: number };
};

/** @ignore */
export interface Float<T extends Floats = Floats> extends DataType<T> { TArray: FType[T]['TArray']; TValue: number }
/** @ignore */
export class Float<T extends Floats = Floats> extends DataType<T> {
    constructor(public readonly precision: Precision) {
        super(Type.Float as T);
    }
    public get ArrayType(): TypedArrayConstructor<FType[T]['TArray']> {
        switch (this.precision) {
            case Precision.HALF: return Uint16Array;
            case Precision.SINGLE: return Float32Array;
            case Precision.DOUBLE: return Float64Array;
        }
        // @ts-ignore
        throw new Error(`Unrecognized ${this[Symbol.toStringTag]} type`);
    }
    public toString() { return `Float${(this.precision << 5) || 16}`; }
    protected static [Symbol.toStringTag] = ((proto: Float) => {
        (<any>proto).precision = null;
        return proto[Symbol.toStringTag] = 'Float';
    })(Float.prototype);
}

/** @ignore */
export class Float16 extends Float<Type.Float16> { constructor() { super(Precision.HALF); } }
/** @ignore */
export class Float32 extends Float<Type.Float32> { constructor() { super(Precision.SINGLE); } }
/** @ignore */
export class Float64 extends Float<Type.Float64> { constructor() { super(Precision.DOUBLE); } }

Object.defineProperty(Float16.prototype, 'ArrayType', { value: Uint16Array });
Object.defineProperty(Float32.prototype, 'ArrayType', { value: Float32Array });
Object.defineProperty(Float64.prototype, 'ArrayType', { value: Float64Array });

/** @ignore */
export interface Binary extends DataType<Type.Binary> { TArray: Uint8Array; TOffsetArray: Int32Array; TValue: Uint8Array; ArrayType: TypedArrayConstructor<Uint8Array>; OffsetArrayType: TypedArrayConstructor<Int32Array> }
/** @ignore */
export class Binary extends DataType<Type.Binary> {
    constructor() {
        super(Type.Binary);
    }
    public toString() { return `Binary`; }
    protected static [Symbol.toStringTag] = ((proto: Binary) => {
        (<any>proto).ArrayType = Uint8Array;
        return proto[Symbol.toStringTag] = 'Binary';
    })(Binary.prototype);
}

/** @ignore */
export interface LargeBinary extends DataType<Type.LargeBinary> { TArray: Uint8Array; TOffsetArray: BigInt64Array; TValue: Uint8Array; ArrayType: TypedArrayConstructor<Uint8Array>; OffsetArrayType: BigIntArrayConstructor<BigInt64Array> }
/** @ignore */
export class LargeBinary extends DataType<Type.LargeBinary> {
    constructor() {
        super(Type.LargeBinary);
    }
    public toString() { return `LargeBinary`; }
    protected static [Symbol.toStringTag] = ((proto: LargeBinary) => {
        (<any>proto).ArrayType = Uint8Array;
        (<any>proto).OffsetArrayType = BigInt64Array;
        return proto[Symbol.toStringTag] = 'LargeBinary';
    })(LargeBinary.prototype);
}

/** @ignore */
export interface Utf8 extends DataType<Type.Utf8> { TArray: Uint8Array; TOffsetArray: Int32Array; TValue: string; ArrayType: TypedArrayConstructor<Uint8Array>; OffsetArrayType: TypedArrayConstructor<Int32Array> }
/** @ignore */
export class Utf8 extends DataType<Type.Utf8> {
    constructor() {
        super(Type.Utf8);
    }
    public toString() { return `Utf8`; }
    protected static [Symbol.toStringTag] = ((proto: Utf8) => {
        (<any>proto).ArrayType = Uint8Array;
        return proto[Symbol.toStringTag] = 'Utf8';
    })(Utf8.prototype);
}

/** @ignore */
export interface LargeUtf8 extends DataType<Type.LargeUtf8> { TArray: Uint8Array; TOffsetArray: BigInt64Array; TValue: string; ArrayType: TypedArrayConstructor<Uint8Array>; OffsetArrayType: BigIntArrayConstructor<BigInt64Array> }
/** @ignore */
export class LargeUtf8 extends DataType<Type.LargeUtf8> {
    constructor() {
        super(Type.LargeUtf8);
    }
    public toString() { return `LargeUtf8`; }
    protected static [Symbol.toStringTag] = ((proto: LargeUtf8) => {
        (<any>proto).ArrayType = Uint8Array;
        (<any>proto).OffsetArrayType = BigInt64Array;
        return proto[Symbol.toStringTag] = 'LargeUtf8';
    })(LargeUtf8.prototype);
}

/** @ignore */
export interface Bool extends DataType<Type.Bool> { TArray: Uint8Array; TValue: boolean; ArrayType: TypedArrayConstructor<Uint8Array> }
/** @ignore */
export class Bool extends DataType<Type.Bool> {
    constructor() {
        super(Type.Bool);
    }
    public toString() { return `Bool`; }
    protected static [Symbol.toStringTag] = ((proto: Bool) => {
        (<any>proto).ArrayType = Uint8Array;
        return proto[Symbol.toStringTag] = 'Bool';
    })(Bool.prototype);
}

/** @ignore */
export interface Decimal extends DataType<Type.Decimal> { TArray: Uint32Array; TValue: Uint32Array; ArrayType: TypedArrayConstructor<Uint32Array> }
/** @ignore */
export class Decimal extends DataType<Type.Decimal> {
    constructor(public readonly scale: number,
        public readonly precision: number,
        public readonly bitWidth: number = 128) {
        super(Type.Decimal);
    }
    public toString() { return `Decimal[${this.precision}e${this.scale > 0 ? `+` : ``}${this.scale}]`; }
    protected static [Symbol.toStringTag] = ((proto: Decimal) => {
        (<any>proto).scale = null;
        (<any>proto).precision = null;
        (<any>proto).ArrayType = Uint32Array;
        return proto[Symbol.toStringTag] = 'Decimal';
    })(Decimal.prototype);
}

/** @ignore */
export type Dates = Type.Date | Type.DateDay | Type.DateMillisecond;
/** @ignore */
type DateType = {
    [Type.Date]: { TArray: Int32Array | BigInt64Array };
    [Type.DateDay]: { TArray: Int32Array };
    [Type.DateMillisecond]: { TArray: BigInt64Array };
};
/** @ignore */
export interface Date_<T extends Dates = Dates> extends DataType<T> {
    TArray: DateType[T]['TArray'];
    TValue: number;
}
/** @ignore */
export class Date_<T extends Dates = Dates> extends DataType<T> {
    constructor(public readonly unit: DateUnit) {
        super(Type.Date as T);
    }
    public toString() { return `Date${(this.unit + 1) * 32}<${DateUnit[this.unit]}>`; }

    public get ArrayType() {
        return this.unit === DateUnit.DAY ? Int32Array : BigInt64Array;
    }
    protected static [Symbol.toStringTag] = ((proto: Date_) => {
        (<any>proto).unit = null;
        return proto[Symbol.toStringTag] = 'Date';
    })(Date_.prototype);
}

/** @ignore */
export class DateDay extends Date_<Type.DateDay> { constructor() { super(DateUnit.DAY); } }
/**
 * A signed 64-bit date representing the elapsed time since UNIX epoch (1970-01-01) in milliseconds.
 * According to the specification, this should be treated as the number of days, in milliseconds,  since the UNIX epoch.
 * Therefore, values must be evenly divisible by `86_400_000` (the number of milliseconds in a standard day).
 *
 * Practically, validation that values of this type are evenly divisible by `86_400_000` is not enforced by this library
 * for performance and usability reasons.
 *
 * Users should prefer to use {@link DateDay} to cleanly represent the number of days. For JS dates,
 * {@link TimestampMillisecond} is the preferred type.
 *
 * @ignore
 */
export class DateMillisecond extends Date_<Type.DateMillisecond> { constructor() { super(DateUnit.MILLISECOND); } }

/** @ignore */
type Times = Type.Time | Type.TimeSecond | Type.TimeMillisecond | Type.TimeMicrosecond | Type.TimeNanosecond;
/** @ignore */
type TimesType = {
    [Type.Time]: { unit: TimeUnit; TValue: number | bigint; TArray: Int32Array | BigInt64Array };
    [Type.TimeSecond]: { unit: TimeUnit.SECOND; TValue: number; TArray: Int32Array };
    [Type.TimeMillisecond]: { unit: TimeUnit.MILLISECOND; TValue: number; TArray: Int32Array };
    [Type.TimeMicrosecond]: { unit: TimeUnit.MICROSECOND; TValue: bigint; TArray: BigInt64Array };
    [Type.TimeNanosecond]: { unit: TimeUnit.NANOSECOND; TValue: bigint; TArray: BigInt64Array };
};

/** @ignore */
interface Time_<T extends Times = Times> extends DataType<T> {
    TArray: TimesType[T]['TArray'];
    TValue: TimesType[T]['TValue'];
}
/** @ignore */
class Time_<T extends Times = Times> extends DataType<T> {
    constructor(public readonly unit: TimesType[T]['unit'],
        public readonly bitWidth: TimeBitWidth) {
        super(Type.Time as T);
    }
    public toString() { return `Time${this.bitWidth}<${TimeUnit[this.unit]}>`; }
    public get ArrayType() {
        switch (this.bitWidth) {
            case 32: return Int32Array;
            case 64: return BigInt64Array;
        }
        // @ts-ignore
        throw new Error(`Unrecognized ${this[Symbol.toStringTag]} type`);
    }
    protected static [Symbol.toStringTag] = ((proto: Time_) => {
        (<any>proto).unit = null;
        (<any>proto).bitWidth = null;
        return proto[Symbol.toStringTag] = 'Time';
    })(Time_.prototype);
}

export { Time_ as Time };

/** @ignore */
export class TimeSecond extends Time_<Type.TimeSecond> { constructor() { super(TimeUnit.SECOND, 32); } }
/** @ignore */
export class TimeMillisecond extends Time_<Type.TimeMillisecond> { constructor() { super(TimeUnit.MILLISECOND, 32); } }
/** @ignore */
export class TimeMicrosecond extends Time_<Type.TimeMicrosecond> { constructor() { super(TimeUnit.MICROSECOND, 64); } }
/** @ignore */
export class TimeNanosecond extends Time_<Type.TimeNanosecond> { constructor() { super(TimeUnit.NANOSECOND, 64); } }

/** @ignore */
type Timestamps = Type.Timestamp | Type.TimestampSecond | Type.TimestampMillisecond | Type.TimestampMicrosecond | Type.TimestampNanosecond;
/** @ignore */
interface Timestamp_<T extends Timestamps = Timestamps> extends DataType<T> {
    TArray: BigInt64Array;
    TValue: number;
    ArrayType: BigIntArrayConstructor<BigInt64Array>;
}

/** @ignore */
class Timestamp_<T extends Timestamps = Timestamps> extends DataType<T> {
    constructor(public readonly unit: TimeUnit,
        public readonly timezone?: string | null) {
        super(Type.Timestamp as T);
    }
    public toString() { return `Timestamp<${TimeUnit[this.unit]}${this.timezone ? `, ${this.timezone}` : ``}>`; }
    protected static [Symbol.toStringTag] = ((proto: Timestamp_) => {
        (<any>proto).unit = null;
        (<any>proto).timezone = null;
        (<any>proto).ArrayType = BigInt64Array;
        return proto[Symbol.toStringTag] = 'Timestamp';
    })(Timestamp_.prototype);
}

export { Timestamp_ as Timestamp };

/** @ignore */
export class TimestampSecond extends Timestamp_<Type.TimestampSecond> { constructor(timezone?: string | null) { super(TimeUnit.SECOND, timezone); } }
/** @ignore */
export class TimestampMillisecond extends Timestamp_<Type.TimestampMillisecond> { constructor(timezone?: string | null) { super(TimeUnit.MILLISECOND, timezone); } }
/** @ignore */
export class TimestampMicrosecond extends Timestamp_<Type.TimestampMicrosecond> { constructor(timezone?: string | null) { super(TimeUnit.MICROSECOND, timezone); } }
/** @ignore */
export class TimestampNanosecond extends Timestamp_<Type.TimestampNanosecond> { constructor(timezone?: string | null) { super(TimeUnit.NANOSECOND, timezone); } }

/** @ignore */
type Intervals = Type.Interval | Type.IntervalDayTime | Type.IntervalYearMonth;
/** @ignore */
interface Interval_<T extends Intervals = Intervals> extends DataType<T> {
    TArray: Int32Array;
    TValue: Int32Array;
    ArrayType: TypedArrayConstructor<Int32Array>;
}

/** @ignore */
class Interval_<T extends Intervals = Intervals> extends DataType<T> {
    constructor(public readonly unit: IntervalUnit) {
        super(Type.Interval as T);
    }
    public toString() { return `Interval<${IntervalUnit[this.unit]}>`; }
    protected static [Symbol.toStringTag] = ((proto: Interval_) => {
        (<any>proto).unit = null;
        (<any>proto).ArrayType = Int32Array;
        return proto[Symbol.toStringTag] = 'Interval';
    })(Interval_.prototype);
}

export { Interval_ as Interval };

/** @ignore */
export class IntervalDayTime extends Interval_<Type.IntervalDayTime> { constructor() { super(IntervalUnit.DAY_TIME); } }
/** @ignore */
export class IntervalYearMonth extends Interval_<Type.IntervalYearMonth> { constructor() { super(IntervalUnit.YEAR_MONTH); } }

/** @ignore */
type Durations = Type.Duration | Type.DurationSecond | Type.DurationMillisecond | Type.DurationMicrosecond | Type.DurationNanosecond;
/** @ignore */
export interface Duration<T extends Durations = Durations> extends DataType<T> {
    TArray: BigInt64Array;
    TValue: bigint;
    ArrayType: BigIntArrayConstructor<BigInt64Array>;
}

/** @ignore */
export class Duration<T extends Durations = Durations> extends DataType<T> {
    constructor(public readonly unit: TimeUnit) {
        super(Type.Duration as T);
    }
    public toString() { return `Duration<${TimeUnit[this.unit]}>`; }
    protected static [Symbol.toStringTag] = ((proto: Duration) => {
        (<any>proto).unit = null;
        (<any>proto).ArrayType = BigInt64Array;
        return proto[Symbol.toStringTag] = 'Duration';
    })(Duration.prototype);
}

/** @ignore */
export class DurationSecond extends Duration<Type.DurationSecond> { constructor() { super(TimeUnit.SECOND); } }
/** @ignore */
export class DurationMillisecond extends Duration<Type.DurationMillisecond> { constructor() { super(TimeUnit.MILLISECOND); } }
/** @ignore */
export class DurationMicrosecond extends Duration<Type.DurationMicrosecond> { constructor() { super(TimeUnit.MICROSECOND); } }
/** @ignore */
export class DurationNanosecond extends Duration<Type.DurationNanosecond> { constructor() { super(TimeUnit.NANOSECOND); } }


/** @ignore */
export interface List<T extends DataType = any> extends DataType<Type.List, { [0]: T }> {
    TArray: Array<T>;
    TValue: Vector<T>;
}

/** @ignore */
export class List<T extends DataType = any> extends DataType<Type.List, { [0]: T }> {
    constructor(child: Field<T>) {
        super(Type.List);
        this.children = [child];
    }
    public declare readonly children: Field<T>[];
    public toString() { return `List<${this.valueType}>`; }
    public get valueType(): T { return this.children[0].type as T; }
    public get valueField(): Field<T> { return this.children[0] as Field<T>; }
    public get ArrayType(): T['ArrayType'] { return this.valueType.ArrayType; }
    protected static [Symbol.toStringTag] = ((proto: List) => {
        (<any>proto).children = null;
        return proto[Symbol.toStringTag] = 'List';
    })(List.prototype);
}

/** @ignore */
export interface Struct<T extends TypeMap = any> extends DataType<Type.Struct, T> {
    TArray: Array<StructRowProxy<T>>;
    TValue: StructRowProxy<T>;
    dataTypes: T;
}

/** @ignore */
export class Struct<T extends TypeMap = any> extends DataType<Type.Struct, T> {
    public declare _row: StructRow<T>;
    public declare readonly children: Field<T[keyof T]>[];
    constructor(children: Field<T[keyof T]>[]) {
        super(Type.Struct);
        this.children = children;
    }
    public toString() { return `Struct<{${this.children.map((f) => `${f.name}:${f.type}`).join(`, `)}}>`; }
    protected static [Symbol.toStringTag] = ((proto: Struct) => {
        (<any>proto).children = null;
        return proto[Symbol.toStringTag] = 'Struct';
    })(Struct.prototype);
}

/** @ignore */
type Unions = Type.Union | Type.DenseUnion | Type.SparseUnion;
/** @ignore */
interface Union_<T extends Unions = Unions> extends DataType<T> { TArray: Int8Array; TValue: any; ArrayType: TypedArrayConstructor<Int8Array> }
/** @ignore */
class Union_<T extends Unions = Unions> extends DataType<T> {
    public declare readonly mode: UnionMode;
    public declare readonly typeIds: Int32Array;
    public declare readonly children: Field<any>[];
    public declare readonly typeIdToChildIndex: { [key: number]: number };
    constructor(mode: UnionMode,
        typeIds: number[] | Int32Array,
        children: Field<any>[]) {
        super(Type.Union as T);
        this.mode = mode;
        this.children = children;
        this.typeIds = typeIds = Int32Array.from(typeIds);
        this.typeIdToChildIndex = typeIds.reduce((typeIdToChildIndex, typeId, idx) => (typeIdToChildIndex[typeId] = idx) && typeIdToChildIndex || typeIdToChildIndex, Object.create(null) as { [key: number]: number });
    }
    public toString() {
        return `${this[Symbol.toStringTag]}<${this.children.map((x) => `${x.type}`).join(` | `)
            }>`;
    }
    protected static [Symbol.toStringTag] = ((proto: Union_) => {
        (<any>proto).mode = null;
        (<any>proto).typeIds = null;
        (<any>proto).children = null;
        (<any>proto).typeIdToChildIndex = null;
        (<any>proto).ArrayType = Int8Array;
        return proto[Symbol.toStringTag] = 'Union';
    })(Union_.prototype);
}

export { Union_ as Union };

/** @ignore */
export class DenseUnion extends Union_<Type.DenseUnion> {
    constructor(typeIds: number[] | Int32Array, children: Field[]) {
        super(UnionMode.Dense, typeIds, children);
    }
}

/** @ignore */
export class SparseUnion extends Union_<Type.SparseUnion> {
    constructor(typeIds: number[] | Int32Array, children: Field[]) {
        super(UnionMode.Sparse, typeIds, children);
    }
}

/** @ignore */
export interface FixedSizeBinary extends DataType<Type.FixedSizeBinary> {
    TArray: Uint8Array;
    TValue: Uint8Array;
    ArrayType: TypedArrayConstructor<Uint8Array>;
}

/** @ignore */
export class FixedSizeBinary extends DataType<Type.FixedSizeBinary> {
    constructor(public readonly byteWidth: number) {
        super(Type.FixedSizeBinary);
    }
    public toString() { return `FixedSizeBinary[${this.byteWidth}]`; }
    protected static [Symbol.toStringTag] = ((proto: FixedSizeBinary) => {
        (<any>proto).byteWidth = null;
        (<any>proto).ArrayType = Uint8Array;
        return proto[Symbol.toStringTag] = 'FixedSizeBinary';
    })(FixedSizeBinary.prototype);
}

/** @ignore */
export interface FixedSizeList<T extends DataType = any> extends DataType<Type.FixedSizeList, { [0]: T }> {
    TArray: Array<T['TArray']>;
    TValue: Vector<T>;
}

/** @ignore */
export class FixedSizeList<T extends DataType = any> extends DataType<Type.FixedSizeList, { [0]: T }> {
    public declare readonly children: Field<T>[];
    constructor(public readonly listSize: number, child: Field<T>) {
        super(Type.FixedSizeList);
        this.children = [child];
    }
    public get valueType(): T { return this.children[0].type as T; }
    public get valueField(): Field<T> { return this.children[0] as Field<T>; }
    public get ArrayType(): T['ArrayType'] { return this.valueType.ArrayType; }
    public toString() { return `FixedSizeList[${this.listSize}]<${this.valueType}>`; }
    protected static [Symbol.toStringTag] = ((proto: FixedSizeList) => {
        (<any>proto).children = null;
        (<any>proto).listSize = null;
        return proto[Symbol.toStringTag] = 'FixedSizeList';
    })(FixedSizeList.prototype);
}

/** @ignore */
export interface Map_<TKey extends DataType = any, TValue extends DataType = any> extends DataType<Type.Map, { [0]: Struct<{ key: TKey; value: TValue }> }> {
    TArray: Array<Map<TKey['TValue'], TValue['TValue'] | null>>;
    TChild: Struct<{ key: TKey; value: TValue }>;
    TValue: MapRow<TKey, TValue>;
}

/** @ignore */
export class Map_<TKey extends DataType = any, TValue extends DataType = any> extends DataType<Type.Map, { [0]: Struct<{ key: TKey; value: TValue }> }> {
    constructor(entries: Field<Struct<{ key: TKey; value: TValue }>>, keysSorted = false) {
        super(Type.Map);
        this.children = [entries];
        this.keysSorted = keysSorted;
        // ARROW-8716
        // https://github.com/apache/arrow/issues/17168
        if (entries) {
            (entries as any)['name'] = 'entries';
            if ((entries as any)?.type?.children) {
                const key = (entries as any)?.type?.children[0];
                if (key) {
                    key['name'] = 'key';
                }
                const val = (entries as any)?.type?.children[1];
                if (val) {
                    val['name'] = 'value';
                }
            }
        }
    }
    public declare readonly keysSorted: boolean;
    public declare readonly children: Field<Struct<{ key: TKey; value: TValue }>>[];
    public get keyType(): TKey { return this.children[0].type.children[0].type as TKey; }
    public get valueType(): TValue { return this.children[0].type.children[1].type as TValue; }
    public get childType() { return this.children[0].type as Struct<{ key: TKey; value: TValue }>; }
    public toString() { return `Map<{${this.children[0].type.children.map((f) => `${f.name}:${f.type}`).join(`, `)}}>`; }
    protected static [Symbol.toStringTag] = ((proto: Map_) => {
        (<any>proto).children = null;
        (<any>proto).keysSorted = null;
        return proto[Symbol.toStringTag] = 'Map_';
    })(Map_.prototype);
}

/** @ignore */
const getId = ((atomicDictionaryId) => () => ++atomicDictionaryId)(-1);

/** @ignore */
export type TKeys = Int8 | Int16 | Int32 | Uint8 | Uint16 | Uint32;

/** @ignore */
export interface Dictionary<T extends DataType = any, TKey extends TKeys = TKeys> extends DataType<Type.Dictionary> {
    TArray: TKey['TArray'];
    TValue: T['TValue'];
}

/** @ignore */
export class Dictionary<T extends DataType = any, TKey extends TKeys = TKeys> extends DataType<Type.Dictionary> {
    public declare readonly id: number;
    public declare readonly indices: TKey;
    public declare readonly dictionary: T;
    public declare readonly isOrdered: boolean;
    constructor(dictionary: T, indices: TKey, id?: bigint | number | null, isOrdered?: boolean | null) {
        super(Type.Dictionary);
        this.indices = indices;
        this.dictionary = dictionary;
        this.isOrdered = isOrdered || false;
        this.id = id == null ? getId() : bigIntToNumber(id);
    }
    public get children() { return this.dictionary.children; }
    public get valueType(): T { return this.dictionary as T; }
    public get ArrayType(): T['ArrayType'] { return this.dictionary.ArrayType; }
    public toString() { return `Dictionary<${this.indices}, ${this.dictionary}>`; }
    protected static [Symbol.toStringTag] = ((proto: Dictionary) => {
        (<any>proto).id = null;
        (<any>proto).indices = null;
        (<any>proto).isOrdered = null;
        (<any>proto).dictionary = null;
        return proto[Symbol.toStringTag] = 'Dictionary';
    })(Dictionary.prototype);
}

/** @ignore */
export type FloatArray = Uint16Array | Float32Array | Float64Array;
/** @ignore */
export type IntArray = Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array;

/** @ignore */
export function strideForType(type: DataType) {
    const t: any = type;
    switch (type.typeId) {
        case Type.Decimal: return (type as Decimal).bitWidth / 32;
        case Type.Interval: return 1 + (t as Interval_).unit;
        // case Type.Int: return 1 + +((t as Int_).bitWidth > 32);
        // case Type.Time: return 1 + +((t as Time_).bitWidth > 32);
        case Type.FixedSizeList: return (t as FixedSizeList).listSize;
        case Type.FixedSizeBinary: return (t as FixedSizeBinary).byteWidth;
        default: return 1;
    }
}

/** @ignore */
export type TypeMap = Record<string | number | symbol, DataType>;
