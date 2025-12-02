import { TypeMap } from '../../type.js';
import { RecordBatch } from '../../recordbatch.js';
/** @ignore */
export declare function recordBatchReaderThroughDOMStream<T extends TypeMap = any>(writableStrategy?: ByteLengthQueuingStrategy, readableStrategy?: {
    autoDestroy: boolean;
}): {
    writable: WritableStream<ArrayBufferView>;
    readable: ReadableStream<RecordBatch<T>>;
};
