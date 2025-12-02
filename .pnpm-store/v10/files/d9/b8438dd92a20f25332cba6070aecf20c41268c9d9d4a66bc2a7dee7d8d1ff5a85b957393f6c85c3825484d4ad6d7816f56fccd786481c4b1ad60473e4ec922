import { IStreamChunk, Stream } from "./Exports.js";
export declare class ChunkedArrayBufferStream extends Stream<ArrayBuffer> {
    private privTargetChunkSize;
    private privNextBufferToWrite;
    private privNextBufferStartTime;
    private privNextBufferReadyBytes;
    constructor(targetChunkSize: number, streamId?: string);
    writeStreamChunk(chunk: IStreamChunk<ArrayBuffer>): void;
    close(): void;
}
