import { WritableStream } from 'stream/web';
import type { DataChunkType } from '../stream/types.js';
export declare class ToolStream<T> extends WritableStream<T> {
    originalStream?: WritableStream;
    private writeQueue;
    constructor({ prefix, callId, name, runId, }: {
        prefix: string;
        callId: string;
        name: string;
        runId: string;
    }, originalStream?: WritableStream);
    write(data: any): Promise<void>;
    custom<T extends {
        type: string;
    }>(data: T extends {
        type: `data-${string}`;
    } ? DataChunkType : T): Promise<void>;
}
//# sourceMappingURL=stream.d.ts.map