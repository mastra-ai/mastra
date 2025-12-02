import { IAudioStreamNode, IStreamChunk } from "../common/Exports.js";
export declare class ReplayableAudioNode implements IAudioStreamNode {
    private privAudioNode;
    private privBytesPerSecond;
    private privBuffers;
    private privReplayOffset;
    private privLastShrinkOffset;
    private privBufferStartOffset;
    private privBufferSerial;
    private privBufferedBytes;
    private privReplay;
    private privLastChunkAcquiredTime;
    constructor(audioSource: IAudioStreamNode, bytesPerSecond: number);
    id(): string;
    read(): Promise<IStreamChunk<ArrayBuffer>>;
    detach(): Promise<void>;
    replay(): void;
    shrinkBuffers(offset: number): void;
    findTimeAtOffset(offset: number): number;
}
