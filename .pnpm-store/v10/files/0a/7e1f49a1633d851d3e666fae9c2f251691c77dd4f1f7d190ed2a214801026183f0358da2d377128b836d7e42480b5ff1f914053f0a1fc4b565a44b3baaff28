"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SshDecoder = void 0;
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const JsonPackMpint_1 = require("../JsonPackMpint");
class SshDecoder {
    constructor(reader = new Reader_1.Reader()) {
        this.reader = reader;
    }
    read(uint8) {
        this.reader.reset(uint8);
        return this.readAny();
    }
    decode(uint8) {
        this.reader.reset(uint8);
        return this.readAny();
    }
    readAny() {
        throw new Error('SshDecoder.readAny() requires explicit type methods');
    }
    readBoolean() {
        return this.reader.u8() !== 0;
    }
    readByte() {
        return this.reader.u8();
    }
    readUint32() {
        const reader = this.reader;
        const value = reader.view.getUint32(reader.x, false);
        reader.x += 4;
        return value;
    }
    readUint64() {
        const reader = this.reader;
        const value = reader.view.getBigUint64(reader.x, false);
        reader.x += 8;
        return value;
    }
    readBinStr() {
        const length = this.readUint32();
        const reader = this.reader;
        const data = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            data[i] = reader.u8();
        }
        return data;
    }
    readStr() {
        const length = this.readUint32();
        const reader = this.reader;
        const utf8Bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            utf8Bytes[i] = reader.u8();
        }
        return new TextDecoder('utf-8').decode(utf8Bytes);
    }
    readAsciiStr() {
        const length = this.readUint32();
        const reader = this.reader;
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(reader.u8());
        }
        return str;
    }
    readMpint() {
        const length = this.readUint32();
        const reader = this.reader;
        const data = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            data[i] = reader.u8();
        }
        return new JsonPackMpint_1.JsonPackMpint(data);
    }
    readNameList() {
        const nameListStr = this.readAsciiStr();
        if (nameListStr === '') {
            return [];
        }
        return nameListStr.split(',');
    }
    readBin() {
        return this.readBinStr();
    }
}
exports.SshDecoder = SshDecoder;
//# sourceMappingURL=SshDecoder.js.map