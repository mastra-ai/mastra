"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BN = exports.bigNumToBigInt = exports.bigNumToString = exports.bigNumToNumber = exports.isArrowBigNumSymbol = void 0;
const buffer_js_1 = require("./buffer.js");
const bigint_js_1 = require("./bigint.js");
/** @ignore */
exports.isArrowBigNumSymbol = Symbol.for('isArrowBigNum');
/** @ignore */
function BigNum(x, ...xs) {
    if (xs.length === 0) {
        return Object.setPrototypeOf((0, buffer_js_1.toArrayBufferView)(this['TypedArray'], x), this.constructor.prototype);
    }
    return Object.setPrototypeOf(new this['TypedArray'](x, ...xs), this.constructor.prototype);
}
BigNum.prototype[exports.isArrowBigNumSymbol] = true;
BigNum.prototype.toJSON = function () { return `"${bigNumToString(this)}"`; };
BigNum.prototype.valueOf = function (scale) { return bigNumToNumber(this, scale); };
BigNum.prototype.toString = function () { return bigNumToString(this); };
BigNum.prototype[Symbol.toPrimitive] = function (hint = 'default') {
    switch (hint) {
        case 'number': return bigNumToNumber(this);
        case 'string': return bigNumToString(this);
        case 'default': return bigNumToBigInt(this);
    }
    // @ts-ignore
    return bigNumToString(this);
};
/** @ignore */
function SignedBigNum(...args) { return BigNum.apply(this, args); }
/** @ignore */
function UnsignedBigNum(...args) { return BigNum.apply(this, args); }
/** @ignore */
function DecimalBigNum(...args) { return BigNum.apply(this, args); }
Object.setPrototypeOf(SignedBigNum.prototype, Object.create(Int32Array.prototype));
Object.setPrototypeOf(UnsignedBigNum.prototype, Object.create(Uint32Array.prototype));
Object.setPrototypeOf(DecimalBigNum.prototype, Object.create(Uint32Array.prototype));
Object.assign(SignedBigNum.prototype, BigNum.prototype, { 'constructor': SignedBigNum, 'signed': true, 'TypedArray': Int32Array, 'BigIntArray': BigInt64Array });
Object.assign(UnsignedBigNum.prototype, BigNum.prototype, { 'constructor': UnsignedBigNum, 'signed': false, 'TypedArray': Uint32Array, 'BigIntArray': BigUint64Array });
Object.assign(DecimalBigNum.prototype, BigNum.prototype, { 'constructor': DecimalBigNum, 'signed': true, 'TypedArray': Uint32Array, 'BigIntArray': BigUint64Array });
//FOR ES2020 COMPATIBILITY
const TWO_TO_THE_64 = BigInt(4294967296) * BigInt(4294967296); // 2^64 = 0x10000000000000000n
const TWO_TO_THE_64_MINUS_1 = TWO_TO_THE_64 - BigInt(1); // (2^32 * 2^32) - 1 = 0xFFFFFFFFFFFFFFFFn
/** @ignore */
function bigNumToNumber(bn, scale) {
    const { buffer, byteOffset, byteLength, 'signed': signed } = bn;
    const words = new BigUint64Array(buffer, byteOffset, byteLength / 8);
    const negative = signed && words.at(-1) & (BigInt(1) << BigInt(63));
    let number = BigInt(0);
    let i = 0;
    if (negative) {
        for (const word of words) {
            number |= (word ^ TWO_TO_THE_64_MINUS_1) * (BigInt(1) << BigInt(64 * i++));
        }
        number *= BigInt(-1);
        number -= BigInt(1);
    }
    else {
        for (const word of words) {
            number |= word * (BigInt(1) << BigInt(64 * i++));
        }
    }
    if (typeof scale === 'number') {
        const denominator = BigInt(Math.pow(10, scale));
        const quotient = number / denominator;
        const remainder = number % denominator;
        return (0, bigint_js_1.bigIntToNumber)(quotient) + ((0, bigint_js_1.bigIntToNumber)(remainder) / (0, bigint_js_1.bigIntToNumber)(denominator));
    }
    return (0, bigint_js_1.bigIntToNumber)(number);
}
exports.bigNumToNumber = bigNumToNumber;
/** @ignore */
function bigNumToString(a) {
    // use BigInt native implementation
    if (a.byteLength === 8) {
        const bigIntArray = new a['BigIntArray'](a.buffer, a.byteOffset, 1);
        return `${bigIntArray[0]}`;
    }
    // unsigned numbers
    if (!a['signed']) {
        return unsignedBigNumToString(a);
    }
    let array = new Uint16Array(a.buffer, a.byteOffset, a.byteLength / 2);
    // detect positive numbers
    const highOrderWord = new Int16Array([array.at(-1)])[0];
    if (highOrderWord >= 0) {
        return unsignedBigNumToString(a);
    }
    // flip the negative value
    array = array.slice();
    let carry = 1;
    for (let i = 0; i < array.length; i++) {
        const elem = array[i];
        const updated = ~elem + carry;
        array[i] = updated;
        carry &= elem === 0 ? 1 : 0;
    }
    const negated = unsignedBigNumToString(array);
    return `-${negated}`;
}
exports.bigNumToString = bigNumToString;
/** @ignore */
function bigNumToBigInt(a) {
    if (a.byteLength === 8) {
        const bigIntArray = new a['BigIntArray'](a.buffer, a.byteOffset, 1);
        return bigIntArray[0];
    }
    else {
        return bigNumToString(a);
    }
}
exports.bigNumToBigInt = bigNumToBigInt;
/** @ignore */
function unsignedBigNumToString(a) {
    let digits = '';
    const base64 = new Uint32Array(2);
    let base32 = new Uint16Array(a.buffer, a.byteOffset, a.byteLength / 2);
    const checks = new Uint32Array((base32 = new Uint16Array(base32).reverse()).buffer);
    let i = -1;
    const n = base32.length - 1;
    do {
        for (base64[0] = base32[i = 0]; i < n;) {
            base32[i++] = base64[1] = base64[0] / 10;
            base64[0] = ((base64[0] - base64[1] * 10) << 16) + base32[i];
        }
        base32[i] = base64[1] = base64[0] / 10;
        base64[0] = base64[0] - base64[1] * 10;
        digits = `${base64[0]}${digits}`;
    } while (checks[0] || checks[1] || checks[2] || checks[3]);
    return digits !== null && digits !== void 0 ? digits : `0`;
}
/** @ignore */
class BN {
    /** @nocollapse */
    static new(num, isSigned) {
        switch (isSigned) {
            case true: return new SignedBigNum(num);
            case false: return new UnsignedBigNum(num);
        }
        switch (num.constructor) {
            case Int8Array:
            case Int16Array:
            case Int32Array:
            case BigInt64Array:
                return new SignedBigNum(num);
        }
        if (num.byteLength === 16) {
            return new DecimalBigNum(num);
        }
        return new UnsignedBigNum(num);
    }
    /** @nocollapse */
    static signed(num) {
        return new SignedBigNum(num);
    }
    /** @nocollapse */
    static unsigned(num) {
        return new UnsignedBigNum(num);
    }
    /** @nocollapse */
    static decimal(num) {
        return new DecimalBigNum(num);
    }
    constructor(num, isSigned) {
        return BN.new(num, isSigned);
    }
}
exports.BN = BN;

//# sourceMappingURL=bn.js.map
