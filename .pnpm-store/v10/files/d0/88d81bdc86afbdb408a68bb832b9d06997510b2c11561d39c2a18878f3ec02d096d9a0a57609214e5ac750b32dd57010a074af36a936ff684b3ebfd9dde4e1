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
exports.ConfigMemoryCodec = void 0;
const ifaces_1 = require("./ifaces");
const memory_1 = require("../datatypes/memory");
const errors_1 = require("../errors");
class ConfigMemoryCodec extends ifaces_1.ScalarCodec {
    tsType = "ConfigMemory";
    tsModule = "gel";
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const val = ctx.preEncode(this, object);
            if (typeof val != "bigint") {
                throw new errors_1.InvalidArgumentError(`a bigint was expected out of a custom cfg::memory codec`);
            }
            buf.writeInt32(8);
            buf.writeBigInt64(val);
            return;
        }
        if (!(object instanceof memory_1.ConfigMemory)) {
            throw new errors_1.InvalidArgumentError(`a ConfigMemory instance was expected, got "${object}"`);
        }
        buf.writeInt32(8);
        buf.writeBigInt64(object._bytes);
    }
    decode(buf, ctx) {
        const val = buf.readBigInt64();
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, val);
        }
        return new memory_1.ConfigMemory(val);
    }
}
exports.ConfigMemoryCodec = ConfigMemoryCodec;
