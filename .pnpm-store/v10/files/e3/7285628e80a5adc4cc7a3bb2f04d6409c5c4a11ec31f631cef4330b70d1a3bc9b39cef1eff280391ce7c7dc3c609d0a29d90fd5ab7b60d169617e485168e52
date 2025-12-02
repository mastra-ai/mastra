/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ReadBuffer } from "../primitives/buffer";
import { WriteBuffer } from "../primitives/buffer";
import { type ICodec, type CodecKind, Codec } from "./ifaces";
import type { CodecContext } from "./context";
import type { Float16Array } from "../utils";
export declare namespace Codecs {
    type Codec<T> = {
        toDatabase: (data: any) => T;
        fromDatabase: (data: T) => any;
    };
    type AnyCodec = {
        toDatabase: (data: any, ...extras: any[]) => any;
        fromDatabase: (data: any, ...extras: any[]) => any;
    };
    type BoolCodec = Codec<boolean>;
    type Int16Codec = Codec<number>;
    type Int32Codec = Codec<number>;
    type Int64Codec = Codec<bigint>;
    type Float32Codec = Codec<number>;
    type Float64Codec = Codec<number>;
    type BigIntCodec = Codec<bigint>;
    type DecimalCodec = Codec<string>;
    type BytesCodec = Codec<Uint8Array>;
    type DateTimeCodec = Codec<bigint>;
    type LocalDateTimeCodec = Codec<bigint>;
    type LocalDateCodec = Codec<[
        years: number,
        months: number,
        days: number
    ]>;
    type LocalTimeCodec = Codec<bigint>;
    type DurationCodec = Codec<bigint>;
    type RelativeDurationCodec = Codec<[
        months: number,
        days: number,
        uSeconds: bigint
    ]>;
    type DateDurationCodec = Codec<[months: number, days: number]>;
    type JsonCodec = Codec<string>;
    type MemoryCodec = Codec<bigint>;
    type PgVectorCodec = Codec<Float32Array>;
    type PGVectorSparseCodec = Codec<[
        dimensions: number,
        indexes: Uint32Array,
        values: Float32Array
    ]>;
    type StrCodec = Codec<string>;
    type UUIDCodec = Codec<Uint8Array>;
    type PGVectorHalfCodec = Codec<Float16Array>;
    type PostgisGeometryCodec = Codec<Uint8Array>;
    type PostgisGeographyCodec = Codec<Uint8Array>;
    type PostgisBox2dCodec = Codec<[
        min: [x: number, y: number],
        max: [x: number, y: number]
    ]>;
    type PostgisBox3dCodec = Codec<[
        min: [x: number, y: number, z: number],
        max: [x: number, y: number, z: number]
    ]>;
    type ScalarCodecs = {
        ["std::bool"]: BoolCodec;
        ["std::int16"]: Int16Codec;
        ["std::int32"]: Int32Codec;
        ["std::int64"]: Int64Codec;
        ["std::float32"]: Float32Codec;
        ["std::float64"]: Float64Codec;
        ["std::bigint"]: BigIntCodec;
        ["std::decimal"]: DecimalCodec;
        ["std::bytes"]: BytesCodec;
        ["std::datetime"]: DateTimeCodec;
        ["std::duration"]: DurationCodec;
        ["std::json"]: JsonCodec;
        ["std::str"]: StrCodec;
        ["std::uuid"]: UUIDCodec;
        ["cal::local_date"]: LocalDateCodec;
        ["cal::local_time"]: LocalTimeCodec;
        ["cal::local_datetime"]: LocalDateTimeCodec;
        ["cal::relative_duration"]: RelativeDurationCodec;
        ["cal::date_duration"]: DateDurationCodec;
        ["cfg::memory"]: MemoryCodec;
        ["std::pg::json"]: JsonCodec;
        ["std::pg::timestamptz"]: DateTimeCodec;
        ["std::pg::timestamp"]: LocalDateTimeCodec;
        ["std::pg::date"]: LocalDateCodec;
        ["std::pg::interval"]: RelativeDurationCodec;
        ["ext::pgvector::vector"]: PgVectorCodec;
        ["ext::pgvector::halfvec"]: PGVectorHalfCodec;
        ["ext::pgvector::sparsevec"]: PGVectorSparseCodec;
        ["ext::postgis::geometry"]: PostgisGeometryCodec;
        ["ext::postgis::geography"]: PostgisGeometryCodec;
        ["ext::postgis::box2d"]: PostgisBox2dCodec;
        ["ext::postgis::box3d"]: PostgisBox3dCodec;
    };
    type SQLRowCodec = {
        fromDatabase: (data: any[], desc: {
            names: string[];
        }) => any;
        toDatabase: (data: any, ...extras: any[]) => any;
    };
    type ContainerCodecs = {
        _private_sql_row: SQLRowCodec;
    };
    type KnownCodecs = ScalarCodecs & ContainerCodecs;
    type CodecSpec = Partial<KnownCodecs> & {
        [key: string]: AnyCodec;
    };
}
export declare class NullCodec extends Codec implements ICodec {
    static BUFFER: Uint8Array;
    encode(_buf: WriteBuffer, _object: any): void;
    decode(_buf: ReadBuffer, _ctx: CodecContext): any;
    getSubcodecs(): ICodec[];
    getKind(): CodecKind;
}
export declare const SCALAR_CODECS: Map<string, ICodec>;
export declare const NULL_CODEC: NullCodec;
export declare const INVALID_CODEC: NullCodec;
