import { TypeMap } from '../../type.js';
import { RecordBatch } from '../../recordbatch.js';
import { RecordBatchWriter } from '../../ipc/writer.js';
/** @ignore */
export declare function recordBatchWriterThroughDOMStream<T extends TypeMap = any>(this: typeof RecordBatchWriter, writableStrategy?: QueuingStrategy<RecordBatch<T>> & {
    autoDestroy: boolean;
}, readableStrategy?: {
    highWaterMark?: number;
    size?: any;
}): {
    writable: WritableStream<RecordBatch<T>>;
    readable: ReadableStream<any>;
};
