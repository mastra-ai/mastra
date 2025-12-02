/// <reference types="node" />
import { Duplex } from 'node:stream';
import type { DuplexOptions } from 'node:stream';
import { AsyncByteStream } from '../../io/stream.js';
import { RecordBatchWriter } from '../../ipc/writer.js';
import { TypeMap } from '../../type.js';
/** @ignore */
export declare function recordBatchWriterThroughNodeStream<T extends TypeMap = any>(this: typeof RecordBatchWriter, options?: DuplexOptions & {
    autoDestroy: boolean;
}): RecordBatchWriterDuplex<T>;
/** @ignore */
type CB = (error?: Error | null | undefined) => void;
/** @ignore */
declare class RecordBatchWriterDuplex<T extends TypeMap = any> extends Duplex {
    private _pulling;
    private _reader;
    private _writer;
    constructor(writer: RecordBatchWriter<T>, options?: DuplexOptions);
    _final(cb?: CB): void;
    _write(x: any, _: string, cb: CB): boolean;
    _read(size: number): void;
    _destroy(err: Error | null, cb: (error: Error | null) => void): void;
    _pull(size: number, reader: AsyncByteStream): Promise<boolean>;
}
export {};
