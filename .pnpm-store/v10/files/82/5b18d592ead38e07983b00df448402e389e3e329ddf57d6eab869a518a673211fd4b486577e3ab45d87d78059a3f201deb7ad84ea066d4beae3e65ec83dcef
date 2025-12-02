"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonPackMpint = void 0;
class JsonPackMpint {
    constructor(data) {
        this.data = data;
    }
    static fromBigInt(value) {
        if (value === BigInt(0)) {
            return new JsonPackMpint(new Uint8Array(0));
        }
        const negative = value < BigInt(0);
        const bytes = [];
        if (negative) {
            const absValue = -value;
            const bitLength = absValue.toString(2).length;
            const byteLength = Math.ceil((bitLength + 1) / 8);
            const twoComplement = (BigInt(1) << BigInt(byteLength * 8)) + value;
            for (let i = byteLength - 1; i >= 0; i--) {
                bytes.push(Number((twoComplement >> BigInt(i * 8)) & BigInt(0xff)));
            }
            while (bytes.length > 0 && bytes[0] === 0xff && bytes.length > 1 && (bytes[1] & 0x80) !== 0) {
                bytes.shift();
            }
        }
        else {
            let tempValue = value;
            while (tempValue > BigInt(0)) {
                bytes.unshift(Number(tempValue & BigInt(0xff)));
                tempValue >>= BigInt(8);
            }
            if (bytes[0] & 0x80) {
                bytes.unshift(0);
            }
        }
        return new JsonPackMpint(new Uint8Array(bytes));
    }
    toBigInt() {
        if (this.data.length === 0) {
            return BigInt(0);
        }
        const negative = (this.data[0] & 0x80) !== 0;
        if (negative) {
            let value = BigInt(0);
            for (let i = 0; i < this.data.length; i++) {
                value = (value << BigInt(8)) | BigInt(this.data[i]);
            }
            const bitLength = this.data.length * 8;
            return value - (BigInt(1) << BigInt(bitLength));
        }
        else {
            let value = BigInt(0);
            for (let i = 0; i < this.data.length; i++) {
                value = (value << BigInt(8)) | BigInt(this.data[i]);
            }
            return value;
        }
    }
    static fromNumber(value) {
        if (!Number.isInteger(value)) {
            throw new Error('Value must be an integer');
        }
        return JsonPackMpint.fromBigInt(BigInt(value));
    }
    toNumber() {
        const bigIntValue = this.toBigInt();
        if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER) || bigIntValue < BigInt(Number.MIN_SAFE_INTEGER)) {
            throw new Error('Value is outside safe integer range');
        }
        return Number(bigIntValue);
    }
}
exports.JsonPackMpint = JsonPackMpint;
//# sourceMappingURL=JsonPackMpint.js.map