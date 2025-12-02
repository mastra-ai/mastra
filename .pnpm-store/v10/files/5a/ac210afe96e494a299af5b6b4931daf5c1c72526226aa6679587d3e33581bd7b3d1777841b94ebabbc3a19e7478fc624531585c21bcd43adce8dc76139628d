"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsCloseFrame = exports.WsPongFrame = exports.WsPingFrame = exports.WsFrameHeader = void 0;
class WsFrameHeader {
    constructor(fin, opcode, length, mask) {
        this.fin = fin;
        this.opcode = opcode;
        this.length = length;
        this.mask = mask;
    }
}
exports.WsFrameHeader = WsFrameHeader;
class WsPingFrame extends WsFrameHeader {
    constructor(fin, opcode, length, mask, data) {
        super(fin, opcode, length, mask);
        this.data = data;
    }
}
exports.WsPingFrame = WsPingFrame;
class WsPongFrame extends WsFrameHeader {
    constructor(fin, opcode, length, mask, data) {
        super(fin, opcode, length, mask);
        this.data = data;
    }
}
exports.WsPongFrame = WsPongFrame;
class WsCloseFrame extends WsFrameHeader {
    constructor(fin, opcode, length, mask, code, reason) {
        super(fin, opcode, length, mask);
        this.code = code;
        this.reason = reason;
    }
}
exports.WsCloseFrame = WsCloseFrame;
//# sourceMappingURL=frames.js.map