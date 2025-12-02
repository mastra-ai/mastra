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
exports.PgVectorSparseVecCodec = exports.PgVectorHalfVecCodec = exports.PgVectorCodec = exports.PG_VECTOR_MAX_DIM = void 0;
const ifaces_1 = require("./ifaces");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
const pgvector_1 = require("../datatypes/pgvector");
exports.PG_VECTOR_MAX_DIM = (1 << 16) - 1;
class PgVectorCodec extends ifaces_1.ScalarCodec {
    tsType = "Float32Array";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (!(object instanceof Float32Array || Array.isArray(object))) {
            throw new errors_1.InvalidArgumentError(`a Float32Array or array of numbers was expected, got "${object}"`);
        }
        if (object.length > exports.PG_VECTOR_MAX_DIM) {
            throw new errors_1.InvalidArgumentError("too many elements in array to encode into pgvector");
        }
        buf
            .writeInt32(4 + object.length * 4)
            .writeUInt16(object.length)
            .writeUInt16(0);
        if (object instanceof Float32Array) {
            for (const el of object) {
                buf.writeFloat32(el);
            }
        }
        else {
            for (const el of object) {
                if (typeof el !== "number") {
                    throw new errors_1.InvalidArgumentError(`elements of vector array expected to be a numbers, got "${el}"`);
                }
                buf.writeFloat32(el);
            }
        }
    }
    decode(buf, ctx) {
        const dim = buf.readUInt16();
        buf.discard(2);
        const vecBuf = buf.readBuffer(dim * 4);
        const data = new DataView(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength);
        const vec = new Float32Array(dim);
        for (let i = 0; i < dim; i++) {
            vec[i] = data.getFloat32(i * 4);
        }
        return ctx.postDecode(this, vec);
    }
}
exports.PgVectorCodec = PgVectorCodec;
class PgVectorHalfVecCodec extends ifaces_1.ScalarCodec {
    tsType = "Float16Array";
    tsModule = "gel";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (!((0, utils_1.isFloat16Array)(object) || Array.isArray(object))) {
            throw new errors_1.InvalidArgumentError(`a Float16Array or array of numbers was expected, got "${object}"`);
        }
        if (object.length > exports.PG_VECTOR_MAX_DIM) {
            throw new errors_1.InvalidArgumentError("too many elements in array to encode into pgvector");
        }
        buf
            .writeInt32(4 + object.length * 2)
            .writeUInt16(object.length)
            .writeUInt16(0);
        const vecBuf = new Uint8Array(object.length * 2);
        const data = new DataView(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength);
        if ((0, utils_1.isFloat16Array)(object)) {
            for (let i = 0; i < object.length; i++) {
                (0, utils_1.setFloat16)(data, i * 2, object[i]);
            }
        }
        else {
            for (let i = 0; i < object.length; i++) {
                if (typeof object[i] !== "number") {
                    throw new errors_1.InvalidArgumentError(`elements of vector array expected to be a numbers, got "${object[i]}"`);
                }
                (0, utils_1.setFloat16)(data, i * 2, object[i]);
            }
        }
        buf.writeBuffer(vecBuf);
    }
    decode(buf, ctx) {
        const dim = buf.readUInt16();
        buf.discard(2);
        const vecBuf = buf.readBuffer(dim * 2);
        const data = new DataView(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength);
        const vec = new utils_1.Float16Array(dim);
        for (let i = 0; i < dim; i++) {
            vec[i] = (0, utils_1.getFloat16)(data, i * 2);
        }
        return ctx.postDecode(this, vec);
    }
}
exports.PgVectorHalfVecCodec = PgVectorHalfVecCodec;
class PgVectorSparseVecCodec extends ifaces_1.ScalarCodec {
    tsType = "SparseVector";
    tsModule = "gel";
    encode(buf, object, ctx) {
        let dims;
        let indexes;
        let values;
        if (ctx.hasOverload(this)) {
            [dims, indexes, values] = ctx.preEncode(this, object);
        }
        else {
            if (!(object instanceof pgvector_1.SparseVector)) {
                throw new errors_1.InvalidArgumentError(`a SparseVector was expected, got "${object}"`);
            }
            dims = object.length;
            indexes = object.indexes;
            values = object.values;
        }
        const indexesLength = indexes.length;
        if (indexesLength > exports.PG_VECTOR_MAX_DIM || indexesLength > dims) {
            throw new errors_1.InvalidArgumentError("too many elements in sparse vector value");
        }
        buf
            .writeUInt32(4 * (3 + indexesLength * 2))
            .writeUInt32(dims)
            .writeUInt32(indexesLength)
            .writeUInt32(0);
        const vecBuf = new Uint8Array(indexesLength * 8);
        const data = new DataView(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength);
        for (let i = 0; i < indexesLength; i++) {
            data.setUint32(i * 4, indexes[i]);
        }
        for (let i = 0; i < indexesLength; i++) {
            data.setFloat32((indexesLength + i) * 4, values[i]);
        }
        buf.writeBuffer(vecBuf);
    }
    decode(buf, ctx) {
        const dim = buf.readUInt32();
        const nnz = buf.readUInt32();
        buf.discard(4);
        const vecBuf = buf.readBuffer(nnz * 8);
        const data = new DataView(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength);
        const indexes = new Uint32Array(nnz);
        for (let i = 0; i < nnz; i++) {
            indexes[i] = data.getUint32(i * 4);
        }
        const vecData = new Float32Array(nnz);
        for (let i = 0; i < nnz; i++) {
            vecData[i] = data.getFloat32((i + nnz) * 4);
        }
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, [
                dim,
                indexes,
                vecData,
            ]);
        }
        return new pgvector_1.SparseVector(dim, indexes, vecData);
    }
}
exports.PgVectorSparseVecCodec = PgVectorSparseVecCodec;
