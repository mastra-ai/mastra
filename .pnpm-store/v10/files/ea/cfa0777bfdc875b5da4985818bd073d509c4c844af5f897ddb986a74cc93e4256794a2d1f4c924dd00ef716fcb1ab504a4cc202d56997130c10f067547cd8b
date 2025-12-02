export interface IStreamChunk<TBuffer> {
    isEnd: boolean;
    buffer: TBuffer;
    timeReceived: number;
}
export declare class Stream<TBuffer> {
    private privId;
    private privIsWriteEnded;
    private privIsReadEnded;
    private privReaderQueue;
    constructor(streamId?: string);
    get isClosed(): boolean;
    get isReadEnded(): boolean;
    get id(): string;
    close(): void;
    writeStreamChunk(streamChunk: IStreamChunk<TBuffer>): void;
    read(): Promise<IStreamChunk<TBuffer>>;
    readEnded(): void;
    private throwIfClosed;
}
