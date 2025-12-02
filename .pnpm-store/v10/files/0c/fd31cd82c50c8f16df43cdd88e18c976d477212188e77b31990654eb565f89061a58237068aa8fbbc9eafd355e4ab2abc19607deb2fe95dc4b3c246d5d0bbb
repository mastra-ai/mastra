import type { ChunkType } from '../../stream/index.js';
import type { Processor } from '../index.js';
export type BatchPartsState = {
    batch: ChunkType[];
    timeoutId: NodeJS.Timeout | undefined;
    timeoutTriggered: boolean;
};
export interface BatchPartsOptions {
    /**
     * Number of parts to batch together before emitting
     * @default 5
     */
    batchSize?: number;
    /**
     * Maximum time to wait before emitting a batch (in milliseconds)
     * If set, will emit the current batch even if it hasn't reached batchSize
     * @default undefined (no timeout)
     */
    maxWaitTime?: number;
    /**
     * Whether to emit immediately when a non-text part is encountered
     * @default true
     */
    emitOnNonText?: boolean;
}
/**
 * Processor that batches multiple stream parts together to reduce stream overhead.
 * Only implements processOutputStream - does not process final results.
 */
export declare class BatchPartsProcessor implements Processor<'batch-parts'> {
    private options;
    readonly id = "batch-parts";
    readonly name = "Batch Parts";
    constructor(options?: BatchPartsOptions);
    processOutputStream(args: {
        part: ChunkType;
        streamParts: ChunkType[];
        state: Record<string, any>;
        abort: (reason?: string) => never;
    }): Promise<ChunkType | null>;
    private flushBatch;
    /**
     * Force flush any remaining batched parts
     * This should be called when the stream ends to ensure no parts are lost
     */
    flush(state?: BatchPartsState): ChunkType | null;
}
//# sourceMappingURL=batch-parts.d.ts.map