import { WsFrameOpcode } from './constants';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class WsFrameEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    constructor(writer?: W);
    encodePing(data: Uint8Array | null): Uint8Array;
    encodePong(data: Uint8Array | null): Uint8Array;
    encodeClose(reason: string, code?: number): Uint8Array;
    encodeHdr(fin: 0 | 1, opcode: WsFrameOpcode, length: number, mask: number): Uint8Array;
    encodeDataMsgHdrFast(length: number): Uint8Array;
    writePing(data: Uint8Array | null): void;
    writePong(data: Uint8Array | null): void;
    writeClose(reason: string, code?: number): void;
    writeHdr(fin: 0 | 1, opcode: WsFrameOpcode, length: number, mask: number): void;
    writeDataMsgHdrFast(length: number): void;
    writeBufXor(buf: Uint8Array, mask: number): void;
}
