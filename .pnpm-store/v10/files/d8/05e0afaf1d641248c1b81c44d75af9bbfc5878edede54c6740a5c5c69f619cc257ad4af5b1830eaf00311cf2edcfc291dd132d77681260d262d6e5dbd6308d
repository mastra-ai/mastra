"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALID_CODEC = exports.NULL_CODEC = exports.SCALAR_CODECS = exports.NullCodec = void 0;
const buffer_1 = require("../primitives/buffer");
const boolean_1 = require("./boolean");
const ifaces_1 = require("./ifaces");
const numbers_1 = require("./numbers");
const numerics_1 = require("./numerics");
const text_1 = require("./text");
const uuid_1 = require("./uuid");
const bytes_1 = require("./bytes");
const json_1 = require("./json");
const datetime_1 = require("./datetime");
const memory_1 = require("./memory");
const pgvector_1 = require("./pgvector");
const postgis_1 = require("./postgis");
const errors_1 = require("../errors");
const consts_1 = require("./consts");
class NullCodec extends ifaces_1.Codec {
    static BUFFER = new buffer_1.WriteBuffer().writeInt32(0).unwrap();
    encode(_buf, _object) {
        throw new errors_1.InternalClientError("null codec cannot used to encode data");
    }
    decode(_buf, _ctx) {
        throw new errors_1.InternalClientError("null codec cannot used to decode data");
    }
    getSubcodecs() {
        return [];
    }
    getKind() {
        return "scalar";
    }
}
exports.NullCodec = NullCodec;
exports.SCALAR_CODECS = new Map();
exports.NULL_CODEC = new NullCodec(consts_1.NULL_CODEC_ID);
exports.INVALID_CODEC = new NullCodec(consts_1.INVALID_CODEC_ID);
function registerScalarCodecs(codecs) {
    for (const [typename, type] of Object.entries(codecs)) {
        const id = consts_1.KNOWN_TYPENAMES.get(typename);
        if (id == null) {
            throw new errors_1.InternalClientError("unknown type name");
        }
        exports.SCALAR_CODECS.set(id, new type(id, typename));
    }
}
registerScalarCodecs({
    "std::int16": numbers_1.Int16Codec,
    "std::int32": numbers_1.Int32Codec,
    "std::int64": numbers_1.Int64Codec,
    "std::float32": numbers_1.Float32Codec,
    "std::float64": numbers_1.Float64Codec,
    "std::bigint": numerics_1.BigIntCodec,
    "std::decimal": numerics_1.DecimalStringCodec,
    "std::bool": boolean_1.BoolCodec,
    "std::json": json_1.JSONCodec,
    "std::str": text_1.StrCodec,
    "std::bytes": bytes_1.BytesCodec,
    "std::uuid": uuid_1.UUIDCodec,
    "cal::local_date": datetime_1.LocalDateCodec,
    "cal::local_time": datetime_1.LocalTimeCodec,
    "cal::local_datetime": datetime_1.LocalDateTimeCodec,
    "std::datetime": datetime_1.DateTimeCodec,
    "std::duration": datetime_1.DurationCodec,
    "cal::relative_duration": datetime_1.RelativeDurationCodec,
    "cal::date_duration": datetime_1.DateDurationCodec,
    "cfg::memory": memory_1.ConfigMemoryCodec,
    "std::pg::json": json_1.PgTextJSONCodec,
    "std::pg::timestamptz": datetime_1.DateTimeCodec,
    "std::pg::timestamp": datetime_1.LocalDateTimeCodec,
    "std::pg::date": datetime_1.LocalDateCodec,
    "std::pg::interval": datetime_1.RelativeDurationCodec,
    "ext::pgvector::vector": pgvector_1.PgVectorCodec,
    "ext::pgvector::halfvec": pgvector_1.PgVectorHalfVecCodec,
    "ext::pgvector::sparsevec": pgvector_1.PgVectorSparseVecCodec,
    "ext::postgis::geometry": postgis_1.PostgisGeometryCodec,
    "ext::postgis::geography": postgis_1.PostgisGeometryCodec,
    "ext::postgis::box2d": postgis_1.PostgisBox2dCodec,
    "ext::postgis::box3d": postgis_1.PostgisBox3dCodec,
});
