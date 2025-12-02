"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsFrameEncoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const maskBuf = new Uint8Array(4);
const maskBufView = new DataView(maskBuf.buffer, maskBuf.byteOffset, maskBuf.byteLength);
class WsFrameEncoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
    }
    encodePing(data) {
        this.writePing(data);
        return this.writer.flush();
    }
    encodePong(data) {
        this.writePong(data);
        return this.writer.flush();
    }
    encodeClose(reason, code = 0) {
        this.writeClose(reason, code);
        return this.writer.flush();
    }
    encodeHdr(fin, opcode, length, mask) {
        this.writeHdr(fin, opcode, length, mask);
        return this.writer.flush();
    }
    encodeDataMsgHdrFast(length) {
        this.writeDataMsgHdrFast(length);
        return this.writer.flush();
    }
    writePing(data) {
        let length = 0;
        if (data && (length = data.length)) {
            this.writeHdr(1, constants_1.WsFrameOpcode.PING, length, 0);
            this.writer.buf(data, length);
        }
        else {
            this.writeHdr(1, constants_1.WsFrameOpcode.PING, 0, 0);
        }
    }
    writePong(data) {
        let length = 0;
        if (data && (length = data.length)) {
            this.writeHdr(1, constants_1.WsFrameOpcode.PONG, length, 0);
            this.writer.buf(data, length);
        }
        else {
            this.writeHdr(1, constants_1.WsFrameOpcode.PONG, 0, 0);
        }
    }
    writeClose(reason, code = 0) {
        if (reason || code) {
            const reasonLength = reason.length;
            const length = 2 + reasonLength;
            const writer = this.writer;
            writer.ensureCapacity(2 +
                2 +
                reasonLength * 4);
            const lengthX = writer.x + 1;
            this.writeHdr(1, constants_1.WsFrameOpcode.CLOSE, length, 0);
            writer.u16(code);
            if (reasonLength) {
                const utf8Length = writer.utf8(reason);
                if (utf8Length !== reasonLength) {
                    if (utf8Length > 126 - 2)
                        throw new errors_1.WsFrameEncodingError();
                    writer.uint8[lengthX] = (writer.uint8[lengthX] & 0b10000000) | (utf8Length + 2);
                }
            }
        }
        else {
            this.writeHdr(1, constants_1.WsFrameOpcode.CLOSE, 0, 0);
        }
    }
    writeHdr(fin, opcode, length, mask) {
        const octet1 = (fin << 7) | opcode;
        const maskBit = mask ? 0b10000000 : 0b00000000;
        const writer = this.writer;
        if (length < 126) {
            const octet2 = maskBit | length;
            writer.u16((octet1 << 8) | octet2);
        }
        else if (length < 0x10000) {
            const octet2 = maskBit | 126;
            writer.u32(((octet1 << 8) | octet2) * 0x10000 + length);
        }
        else {
            const octet2 = maskBit | 127;
            writer.u16((octet1 << 8) | octet2);
            writer.u32(0);
            writer.u32(length);
        }
        if (mask)
            writer.u32(mask);
    }
    writeDataMsgHdrFast(length) {
        const writer = this.writer;
        if (length < 126) {
            writer.u16(33280 + length);
            return;
        }
        if (length < 0x10000) {
            writer.u32(2189295616 + length);
            return;
        }
        writer.u16(33407);
        writer.u32(0);
        writer.u32(length);
    }
    writeBufXor(buf, mask) {
        maskBufView.setUint32(0, mask, false);
        const writer = this.writer;
        const length = buf.length;
        writer.ensureCapacity(length);
        let x = writer.x;
        const uint8 = writer.uint8;
        for (let i = 0; i < length; i++)
            uint8[x++] = buf[i] ^ maskBuf[i & 3];
        writer.x = x;
    }
}
exports.WsFrameEncoder = WsFrameEncoder;
//# sourceMappingURL=WsFrameEncoder.js.map