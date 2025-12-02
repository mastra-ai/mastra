"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsFrameDecoder = void 0;
const StreamingOctetReader_1 = require("@jsonjoy.com/buffers/lib/StreamingOctetReader");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const frames_1 = require("./frames");
class WsFrameDecoder {
    constructor() {
        this.reader = new StreamingOctetReader_1.StreamingOctetReader();
    }
    push(uint8) {
        this.reader.push(uint8);
    }
    readFrameHeader() {
        try {
            const reader = this.reader;
            if (reader.size() < 2)
                return undefined;
            const b0 = reader.u8();
            const b1 = reader.u8();
            const fin = (b0 >>> 7);
            const opcode = b0 & 0b1111;
            const maskBit = b1 >>> 7;
            let length = b1 & 0b01111111;
            if (length === 126) {
                if (reader.size() < 2)
                    return undefined;
                length = (reader.u8() << 8) | reader.u8();
            }
            else if (length === 127) {
                if (reader.size() < 8)
                    return undefined;
                reader.skip(4);
                length = reader.u32();
            }
            let mask;
            if (maskBit) {
                if (reader.size() < 4)
                    return undefined;
                mask = [reader.u8(), reader.u8(), reader.u8(), reader.u8()];
            }
            if (opcode >= constants_1.WsFrameOpcode.MIN_CONTROL_OPCODE) {
                switch (opcode) {
                    case constants_1.WsFrameOpcode.CLOSE: {
                        return new frames_1.WsCloseFrame(fin, opcode, length, mask, 0, '');
                    }
                    case constants_1.WsFrameOpcode.PING: {
                        if (length > 125)
                            throw new errors_1.WsFrameDecodingError();
                        const data = mask ? reader.bufXor(length, mask, 0) : reader.buf(length);
                        return new frames_1.WsPingFrame(fin, opcode, length, mask, data);
                    }
                    case constants_1.WsFrameOpcode.PONG: {
                        if (length > 125)
                            throw new errors_1.WsFrameDecodingError();
                        const data = mask ? reader.bufXor(length, mask, 0) : reader.buf(length);
                        return new frames_1.WsPongFrame(fin, opcode, length, mask, data);
                    }
                    default: {
                        throw new errors_1.WsFrameDecodingError();
                    }
                }
            }
            return new frames_1.WsFrameHeader(fin, opcode, length, mask);
        }
        catch (err) {
            if (err instanceof RangeError)
                return undefined;
            throw err;
        }
    }
    readFrameData(frame, remaining, dst, pos) {
        const reader = this.reader;
        const mask = frame.mask;
        const readSize = Math.min(reader.size(), remaining);
        if (!mask)
            reader.copy(readSize, dst, pos);
        else {
            const alreadyRead = frame.length - remaining;
            reader.copyXor(readSize, dst, pos, mask, alreadyRead);
        }
        return remaining - readSize;
    }
    copyFrameData(frame, dst, pos) {
        const reader = this.reader;
        const mask = frame.mask;
        const readSize = frame.length;
        if (!mask)
            reader.copy(readSize, dst, pos);
        else
            reader.copyXor(readSize, dst, pos, mask, 0);
    }
    readCloseFrameData(frame) {
        let length = frame.length;
        if (length > 125)
            throw new errors_1.WsFrameDecodingError();
        let code = 0;
        let reason = '';
        if (length > 0) {
            if (length < 2)
                throw new errors_1.WsFrameDecodingError();
            const reader = this.reader;
            const mask = frame.mask;
            const octet1 = reader.u8() ^ (mask ? mask[0] : 0);
            const octet2 = reader.u8() ^ (mask ? mask[1] : 0);
            code = (octet1 << 8) | octet2;
            length -= 2;
            if (length)
                reason = reader.utf8(length, mask ?? [0, 0, 0, 0], 2);
        }
        frame.code = code;
        frame.reason = reason;
    }
}
exports.WsFrameDecoder = WsFrameDecoder;
//# sourceMappingURL=WsFrameDecoder.js.map