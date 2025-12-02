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
exports.KNOWN_TYPENAMES = exports.KNOWN_TYPES = exports.INVALID_CODEC_ID = exports.NULL_CODEC_ID = void 0;
exports.NULL_CODEC_ID = "00000000000000000000000000000000";
exports.INVALID_CODEC_ID = "ffffffffffffffffffffffffffffffff";
exports.KNOWN_TYPES = new Map([
    ["00000000000000000000000000000001", "anytype"],
    ["00000000000000000000000000000002", "anytuple"],
    ["00000000000000000000000000000003", "anyobject"],
    ["000000000000000000000000000000f0", "std"],
    ["000000000000000000000000000000ff", "empty-tuple"],
    ["00000000000000000000000000000100", "std::uuid"],
    ["00000000000000000000000000000101", "std::str"],
    ["00000000000000000000000000000102", "std::bytes"],
    ["00000000000000000000000000000103", "std::int16"],
    ["00000000000000000000000000000104", "std::int32"],
    ["00000000000000000000000000000105", "std::int64"],
    ["00000000000000000000000000000106", "std::float32"],
    ["00000000000000000000000000000107", "std::float64"],
    ["00000000000000000000000000000108", "std::decimal"],
    ["00000000000000000000000000000109", "std::bool"],
    ["0000000000000000000000000000010a", "std::datetime"],
    ["0000000000000000000000000000010b", "cal::local_datetime"],
    ["0000000000000000000000000000010c", "cal::local_date"],
    ["0000000000000000000000000000010d", "cal::local_time"],
    ["0000000000000000000000000000010e", "std::duration"],
    ["0000000000000000000000000000010f", "std::json"],
    ["00000000000000000000000000000110", "std::bigint"],
    ["00000000000000000000000000000111", "cal::relative_duration"],
    ["00000000000000000000000000000112", "cal::date_duration"],
    ["00000000000000000000000000000130", "cfg::memory"],
    ["00000000000000000000000001000001", "std::pg::json"],
    ["00000000000000000000000001000002", "std::pg::timestamptz"],
    ["00000000000000000000000001000003", "std::pg::timestamp"],
    ["00000000000000000000000001000004", "std::pg::date"],
    ["00000000000000000000000001000005", "std::pg::interval"],
    ["9565dd8804f511eea6910b6ebe179825", "ext::pgvector::vector"],
    ["4ba84534188e43b4a7cecea2af0f405b", "ext::pgvector::halfvec"],
    ["003e434dcac2430ab238fb39d73447d2", "ext::pgvector::sparsevec"],
    ["44c901c0d922489483c8061bd05e4840", "ext::postgis::geometry"],
    ["4d7388783a5f4821ab769d8e7d6b32c4", "ext::postgis::geography"],
    ["7fae553663114f608eb9096a5d972f48", "ext::postgis::box2d"],
    ["c1a50ff8fded48b085c24905a8481433", "ext::postgis::box3d"],
]);
exports.KNOWN_TYPENAMES = (() => {
    const res = new Map();
    for (const [id, name] of exports.KNOWN_TYPES.entries()) {
        res.set(name, id);
    }
    return res;
})();
