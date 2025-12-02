/// <reference types="node" />
import { Duplex, DuplexOptions } from 'node:stream';
import { AsyncByteQueue } from '../../io/stream.js';
import { RecordBatchReader } from '../../ipc/reader.js';
import { TypeMap } from '../../type.js';
/** @ignore */
export declare function recordBatchReaderThroughNodeStream<T extends TypeMap = any>(options?: DuplexOptions & {
    autoDestroy: boolean;
}): RecordBatchReaderDuplex<T>;
/** @ignore */
type CB = (error?: Error | null | undefined) => void;
/** @ignore */
declare class RecordBatchReaderDuplex<T extends TypeMap = any> extends Duplex {
    private _pulling;
    private _autoDestroy;
    private _reader;
    private _asyncQueue;
    constructor(options?: DuplexOptions & {
        autoDestroy: boolean;
    });
    _final(cb?: CB): void;
    _write(x: any, _: string, cb: CB): boolean;
    _read(size: number): void;
    _destroy(err: Error | null, cb: (error: Error | null) => void): void;
    _open(source: AsyncByteQueue): Promise<import("../../ipc/reader.js").AsyncRecordBatchStreamReader<T>>;
    _pull(size: number, reader: RecordBatchReader<T>): Promise<boolean>;
}
export {};
