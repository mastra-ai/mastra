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
exports.DecimalStringCodec = exports.BigIntCodec = void 0;
const ifaces_1 = require("./ifaces");
const errors_1 = require("../errors");
const NUMERIC_POS = 0x0000;
const NUMERIC_NEG = 0x4000;
class BigIntCodec extends ifaces_1.ScalarCodec {
    tsType = "bigint";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "bigint") {
            throw new errors_1.InvalidArgumentError(`a bigint was expected, got "${object}"`);
        }
        const digits = [];
        let sign = NUMERIC_POS;
        let uval = object;
        if (object === 0n) {
            buf.writeUInt32(8);
            buf.writeUInt32(0);
            buf.writeUInt16(NUMERIC_POS);
            buf.writeUInt16(0);
            return;
        }
        if (object < 0n) {
            sign = NUMERIC_NEG;
            uval = -uval;
        }
        while (uval) {
            const mod = uval % 10000n;
            uval /= 10000n;
            digits.push(mod);
        }
        buf.writeUInt32(8 + digits.length * 2);
        buf.writeUInt16(digits.length);
        buf.writeUInt16(digits.length - 1);
        buf.writeUInt16(sign);
        buf.writeUInt16(0);
        for (let i = digits.length - 1; i >= 0; i--) {
            buf.writeUInt16(Number(digits[i]));
        }
    }
    decode(buf, ctx) {
        const val = BigInt(decodeBigIntToString(buf));
        return ctx.postDecode(this, val);
    }
}
exports.BigIntCodec = BigIntCodec;
class DecimalStringCodec extends ifaces_1.ScalarCodec {
    tsType = "string";
    encode(buf, object, ctx) {
        object = ctx.preEncode(this, object);
        if (typeof object !== "string") {
            throw new errors_1.InvalidArgumentError(`a string was expected, got "${object}"`);
        }
        const match = object.match(/^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([-+]?[0-9]+))?$/);
        if (!match) {
            throw new errors_1.InvalidArgumentError(`invalid decimal string "${object}"`);
        }
        const [_, sign, int, _frac, _exp] = match;
        const frac = _frac ?? "";
        const exp = _exp ? parseInt(_exp, 10) : 0;
        const sdigits = int.padStart(Math.ceil(int.length / 4) * 4, "0") +
            frac.padEnd(Math.ceil(frac.length / 4) * 4, "0");
        const digits = [];
        for (let i = 0, len = sdigits.length; i < len; i += 4) {
            digits.push(parseInt(sdigits.slice(i, i + 4), 10));
        }
        buf.writeUInt32(8 + digits.length * 2);
        buf.writeUInt16(digits.length);
        buf.writeInt16(Math.ceil((int.length + exp) / 4) - 1);
        buf.writeUInt16(sign === "-" ? NUMERIC_NEG : NUMERIC_POS);
        buf.writeUInt16(Math.max(frac.length - exp, 0));
        for (let i = 0, len = digits.length; i < len; i++) {
            buf.writeUInt16(digits[i]);
        }
    }
    decode(buf, ctx) {
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, decodeDecimalToString(buf));
        }
        return decodeDecimalToString(buf);
    }
}
exports.DecimalStringCodec = DecimalStringCodec;
function decodeBigIntToString(buf) {
    const ndigits = buf.readUInt16();
    const weight = buf.readInt16();
    const sign = buf.readUInt16();
    const dscale = buf.readUInt16();
    let result = "";
    switch (sign) {
        case NUMERIC_POS:
            break;
        case NUMERIC_NEG:
            result += "-";
            break;
        default:
            throw new errors_1.ProtocolError("bad bigint sign data");
    }
    if (dscale !== 0) {
        throw new errors_1.ProtocolError("bigint data has fractional part");
    }
    if (ndigits === 0) {
        return "0";
    }
    let i = weight;
    let d = 0;
    while (i >= 0) {
        if (i <= weight && d < ndigits) {
            const digit = buf.readUInt16().toString();
            result += d > 0 ? digit.padStart(4, "0") : digit;
            d++;
        }
        else {
            result += "0000";
        }
        i--;
    }
    return result;
}
function decodeDecimalToString(buf) {
    const ndigits = buf.readUInt16();
    const weight = buf.readInt16();
    const sign = buf.readUInt16();
    const dscale = buf.readUInt16();
    let result = "";
    switch (sign) {
        case NUMERIC_POS:
            break;
        case NUMERIC_NEG:
            result += "-";
            break;
        default:
            throw new errors_1.ProtocolError("bad decimal sign data");
    }
    let d = 0;
    if (weight < 0) {
        d = weight + 1;
        result += "0";
    }
    else {
        for (d = 0; d <= weight; d++) {
            const digit = d < ndigits ? buf.readUInt16() : 0;
            let sdigit = digit.toString();
            if (d > 0) {
                sdigit = sdigit.padStart(4, "0");
            }
            result += sdigit;
        }
    }
    if (dscale > 0) {
        result += ".";
        const end = result.length + dscale;
        for (let i = 0; i < dscale; d++, i += 4) {
            const digit = d >= 0 && d < ndigits ? buf.readUInt16() : 0;
            result += digit.toString().padStart(4, "0");
        }
        result = result.slice(0, end);
    }
    return result;
}
