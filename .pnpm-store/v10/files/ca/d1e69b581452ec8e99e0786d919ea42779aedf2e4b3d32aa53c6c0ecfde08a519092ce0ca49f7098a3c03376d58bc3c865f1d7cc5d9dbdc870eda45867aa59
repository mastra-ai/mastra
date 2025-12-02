export declare class WsFrameHeader {
    readonly fin: 0 | 1;
    readonly opcode: number;
    readonly length: number;
    readonly mask: undefined | [number, number, number, number];
    constructor(fin: 0 | 1, opcode: number, length: number, mask: undefined | [number, number, number, number]);
}
export declare class WsPingFrame extends WsFrameHeader {
    readonly data: Uint8Array;
    constructor(fin: 0 | 1, opcode: number, length: number, mask: undefined | [number, number, number, number], data: Uint8Array);
}
export declare class WsPongFrame extends WsFrameHeader {
    readonly data: Uint8Array;
    constructor(fin: 0 | 1, opcode: number, length: number, mask: undefined | [number, number, number, number], data: Uint8Array);
}
export declare class WsCloseFrame extends WsFrameHeader {
    code: number;
    reason: string;
    constructor(fin: 0 | 1, opcode: number, length: number, mask: undefined | [number, number, number, number], code: number, reason: string);
}
