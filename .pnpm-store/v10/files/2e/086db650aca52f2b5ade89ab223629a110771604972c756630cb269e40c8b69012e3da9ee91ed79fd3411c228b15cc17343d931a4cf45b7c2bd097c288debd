/**
 * A reusable readable stream that allows multiple consumers to read from the same source stream
 * concurrently while it's actively streaming, without forcing consumers to wait for full buffering.
 *
 * Key features:
 * - Multiple concurrent consumers with independent read positions
 * - New consumers can attach while streaming is active
 * - Efficient memory management with automatic cleanup
 * - Each consumer can read at their own pace
 */
export declare class ReusableReadableStream<T> {
    private sourceStream;
    private buffer;
    private consumers;
    private nextConsumerId;
    private sourceReader;
    private sourceComplete;
    private sourceError;
    private pumpStarted;
    constructor(sourceStream: ReadableStream<T>);
    /**
     * Create a new consumer that can independently iterate over the stream.
     * Multiple consumers can be created and will all receive the same data.
     */
    createConsumer(): AsyncIterableIterator<T>;
    /**
     * Start pumping data from the source stream into the buffer
     */
    private startPump;
    /**
     * Notify all waiting consumers that new data is available
     */
    private notifyAllConsumers;
    /**
     * Cancel the source stream and all consumers
     */
    cancel(): Promise<void>;
}
//# sourceMappingURL=reusable-stream.d.ts.map