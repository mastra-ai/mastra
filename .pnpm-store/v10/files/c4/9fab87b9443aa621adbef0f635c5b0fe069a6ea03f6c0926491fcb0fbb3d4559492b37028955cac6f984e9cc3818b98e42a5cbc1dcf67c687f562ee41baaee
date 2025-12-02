"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SshEncoder = void 0;
const JsonPackMpint_1 = require("../JsonPackMpint");
class SshEncoder {
    constructor(writer) {
        this.writer = writer;
    }
    encode(value) {
        const writer = this.writer;
        writer.reset();
        this.writeAny(value);
        return writer.flush();
    }
    writeUnknown(value) {
        throw new Error('SSH encoder does not support unknown types');
    }
    writeAny(value) {
        switch (typeof value) {
            case 'boolean':
                return this.writeBoolean(value);
            case 'number':
                return this.writeNumber(value);
            case 'string':
                return this.writeStr(value);
            case 'object': {
                if (value === null)
                    return this.writeNull();
                const constructor = value.constructor;
                switch (constructor) {
                    case Uint8Array:
                        return this.writeBin(value);
                    case Array:
                        return this.writeNameList(value);
                    case JsonPackMpint_1.JsonPackMpint:
                        return this.writeMpint(value);
                    default:
                        return this.writeUnknown(value);
                }
            }
            case 'bigint':
                return this.writeUint64(value);
            case 'undefined':
                return this.writeNull();
            default:
                return this.writeUnknown(value);
        }
    }
    writeNull() {
        throw new Error('SSH protocol does not have a null type');
    }
    writeBoolean(bool) {
        this.writer.u8(bool ? 1 : 0);
    }
    writeByte(byte) {
        this.writer.u8(byte & 0xff);
    }
    writeUint32(uint) {
        const writer = this.writer;
        writer.ensureCapacity(4);
        writer.view.setUint32(writer.x, Math.trunc(uint) >>> 0, false);
        writer.move(4);
    }
    writeUint64(uint) {
        const writer = this.writer;
        writer.ensureCapacity(8);
        if (typeof uint === 'bigint') {
            writer.view.setBigUint64(writer.x, uint, false);
        }
        else {
            const truncated = Math.trunc(Math.abs(uint));
            const high = Math.floor(truncated / 0x100000000);
            const low = truncated >>> 0;
            writer.view.setUint32(writer.x, high, false);
            writer.view.setUint32(writer.x + 4, low, false);
        }
        writer.move(8);
    }
    writeBinStr(data) {
        this.writeUint32(data.length);
        this.writer.buf(data, data.length);
    }
    writeStr(str) {
        const writer = this.writer;
        const maxSize = str.length * 4;
        writer.ensureCapacity(4 + maxSize);
        const lengthOffset = writer.x;
        writer.x += 4;
        const bytesWritten = writer.utf8(str);
        const endPos = writer.x;
        writer.x = lengthOffset;
        this.writeUint32(bytesWritten);
        writer.x = endPos;
    }
    writeAsciiStr(str) {
        const writer = this.writer;
        writer.ensureCapacity(4 + str.length);
        this.writeUint32(str.length);
        for (let i = 0; i < str.length; i++) {
            writer.u8(str.charCodeAt(i) & 0x7f);
        }
    }
    writeMpint(mpint) {
        this.writeUint32(mpint.data.length);
        this.writer.buf(mpint.data, mpint.data.length);
    }
    writeNameList(names) {
        const nameListStr = names.join(',');
        this.writeAsciiStr(nameListStr);
    }
    writeNumber(num) {
        if (Number.isInteger(num)) {
            if (num >= 0 && num <= 0xffffffff) {
                this.writeUint32(num);
            }
            else {
                this.writeUint64(num);
            }
        }
        else {
            throw new Error('SSH protocol does not support floating point numbers');
        }
    }
    writeInteger(int) {
        this.writeUint32(int);
    }
    writeUInteger(uint) {
        this.writeUint32(uint);
    }
    writeFloat(float) {
        throw new Error('SSH protocol does not support floating point numbers');
    }
    writeBin(buf) {
        this.writeBinStr(buf);
    }
    writeArr(arr) {
        throw new Error('SSH protocol does not have a generic array type. Use writeNameList for name-list type.');
    }
    writeObj(obj) {
        throw new Error('SSH protocol does not have an object type');
    }
}
exports.SshEncoder = SshEncoder;
//# sourceMappingURL=SshEncoder.js.map