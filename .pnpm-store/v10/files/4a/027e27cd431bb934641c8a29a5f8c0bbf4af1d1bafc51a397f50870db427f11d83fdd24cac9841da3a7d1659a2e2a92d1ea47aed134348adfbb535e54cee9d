"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XdrDecoder = void 0;
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
class XdrDecoder {
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
        throw new Error('not implemented');
    }
    readVoid() {
    }
    readBoolean() {
        return this.readInt() !== 0;
    }
    readInt() {
        const reader = this.reader;
        const value = reader.view.getInt32(reader.x, false);
        reader.x += 4;
        return value;
    }
    readUnsignedInt() {
        const reader = this.reader;
        const value = reader.view.getUint32(reader.x, false);
        reader.x += 4;
        return value;
    }
    readHyper() {
        const reader = this.reader;
        const value = reader.view.getBigInt64(reader.x, false);
        reader.x += 8;
        return value;
    }
    readUnsignedHyper() {
        const reader = this.reader;
        const value = reader.view.getBigUint64(reader.x, false);
        reader.x += 8;
        return value;
    }
    readFloat() {
        const reader = this.reader;
        const value = reader.view.getFloat32(reader.x, false);
        reader.x += 4;
        return value;
    }
    readDouble() {
        const reader = this.reader;
        const value = reader.view.getFloat64(reader.x, false);
        reader.x += 8;
        return value;
    }
    readQuadruple() {
        throw new Error('not implemented');
    }
    readOpaque(size) {
        const reader = this.reader;
        const data = reader.buf(size);
        const paddedSize = size % 4 === 0 ? size : size + (4 - (size % 4));
        reader.skip(paddedSize - size);
        return data;
    }
    readVarlenOpaque() {
        const size = this.readUnsignedInt();
        return this.readOpaque(size);
    }
    readString() {
        const size = this.readUnsignedInt();
        const reader = this.reader;
        const text = reader.utf8(size);
        const paddedSize = size % 4 === 0 ? size : size + (4 - (size % 4));
        reader.skip(paddedSize - size);
        return text;
    }
    readEnum() {
        return this.readInt();
    }
    readArray(size, elementReader) {
        const array = [];
        for (let i = 0; i < size; i++)
            array.push(elementReader());
        return array;
    }
    readVarlenArray(elementReader) {
        const size = this.readUnsignedInt();
        return this.readArray(size, elementReader);
    }
}
exports.XdrDecoder = XdrDecoder;
//# sourceMappingURL=XdrDecoder.js.map