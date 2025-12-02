import { StreamingOctetReader } from '@jsonjoy.com/buffers/lib/StreamingOctetReader';
import { WsCloseFrame, WsFrameHeader } from './frames';
export declare class WsFrameDecoder {
    readonly reader: StreamingOctetReader;
    push(uint8: Uint8Array): void;
    readFrameHeader(): WsFrameHeader | undefined;
    readFrameData(frame: WsFrameHeader, remaining: number, dst: Uint8Array, pos: number): number;
    copyFrameData(frame: WsFrameHeader, dst: Uint8Array, pos: number): void;
    readCloseFrameData(frame: WsCloseFrame): void;
}
