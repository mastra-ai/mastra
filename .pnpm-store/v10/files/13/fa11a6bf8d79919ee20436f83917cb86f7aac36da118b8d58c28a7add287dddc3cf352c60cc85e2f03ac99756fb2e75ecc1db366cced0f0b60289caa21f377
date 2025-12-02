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
exports.Float64Codec = exports.Float32Codec = exports.Int16Codec = exports.Int32Codec = exports.Int64Codec = void 0;
const ifaces_1 = require("./ifaces");
const errors_1 = require("../errors");
class Int64Codec extends ifaces_1.ScalarCodec {
    tsType = "number";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const val = ctx.preEncode(this, object);
            buf.writeInt32(8);
            buf.writeBigInt64(val);
            return;
        }
        if (typeof object !== "number") {
            throw new errors_1.InvalidArgumentError(`a number was expected, got "${object}"`);
        }
        buf.writeInt32(8);
        buf.writeInt64(object);
    }
    decode(buf, ctx) {
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, buf.readBigInt64());
        }
        return buf.readInt64();
    }
}
exports.Int64Codec = Int64Codec;
class Int32Codec extends ifaces_1.ScalarCodec {
    tsType = "number";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "number") {
            throw new errors_1.InvalidArgumentError(`a number was expected, got "${object}"`);
        }
        buf.writeInt32(4);
        buf.writeInt32(object);
    }
    decode(buf, ctx) {
        return ctx.postDecode(this, buf.readInt32());
    }
}
exports.Int32Codec = Int32Codec;
class Int16Codec extends ifaces_1.ScalarCodec {
    tsType = "number";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "number") {
            throw new errors_1.InvalidArgumentError(`a number was expected, got "${object}"`);
        }
        buf.writeInt32(2);
        buf.writeInt16(object);
    }
    decode(buf, ctx) {
        return ctx.postDecode(this, buf.readInt16());
    }
}
exports.Int16Codec = Int16Codec;
class Float32Codec extends ifaces_1.ScalarCodec {
    tsType = "number";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "number") {
            throw new errors_1.InvalidArgumentError(`a number was expected, got "${object}"`);
        }
        buf.writeInt32(4);
        buf.writeFloat32(object);
    }
    decode(buf, ctx) {
        return ctx.postDecode(this, buf.readFloat32());
    }
}
exports.Float32Codec = Float32Codec;
class Float64Codec extends ifaces_1.ScalarCodec {
    tsType = "number";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "number") {
            throw new errors_1.InvalidArgumentError(`a number was expected, got "${object}"`);
        }
        buf.writeInt32(8);
        buf.writeFloat64(object);
    }
    decode(buf, ctx) {
        return ctx.postDecode(this, buf.readFloat64());
    }
}
exports.Float64Codec = Float64Codec;
