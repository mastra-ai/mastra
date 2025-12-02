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
exports.BoolCodec = void 0;
const ifaces_1 = require("./ifaces");
const errors_1 = require("../errors");
class BoolCodec extends ifaces_1.ScalarCodec {
    tsType = "boolean";
    encode(buf, object, ctx) {
        const val = ctx.preEncode(this, object);
        const typeOf = typeof val;
        if (typeOf !== "boolean" && typeOf !== "number") {
            throw new errors_1.InvalidArgumentError(`a boolean or a number was expected, got "${val}"`);
        }
        buf.writeInt32(1);
        buf.writeChar(val ? 1 : 0);
    }
    decode(buf, ctx) {
        return ctx.postDecode(this, buf.readUInt8() !== 0);
    }
}
exports.BoolCodec = BoolCodec;
