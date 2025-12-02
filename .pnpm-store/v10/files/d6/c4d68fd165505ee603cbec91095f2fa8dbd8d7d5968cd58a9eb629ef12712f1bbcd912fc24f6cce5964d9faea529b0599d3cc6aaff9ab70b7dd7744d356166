/// <reference types="node" />
import { Data } from '../data.js';
import { Table } from '../table.js';
import { Vector } from '../vector.js';
import { TypeMap } from '../type.js';
import { Schema } from '../schema.js';
import { Message } from './metadata/message.js';
import { FileBlock } from './metadata/file.js';
import { MessageHeader } from '../enum.js';
import { WritableSink, AsyncByteQueue } from '../io/stream.js';
import { ArrayBufferViewInput } from '../util/buffer.js';
import { RecordBatch } from '../recordbatch.js';
import { Writable, ReadableInterop, ReadableDOMStreamOptions } from '../io/interfaces.js';
import type { DuplexOptions, Duplex, ReadableOptions } from 'node:stream';
export interface RecordBatchStreamWriterOptions {
    /**
     *
     */
    autoDestroy?: boolean;
    /**
     * A flag indicating whether the RecordBatchWriter should construct pre-0.15.0
     * encapsulated IPC Messages, which reserves  4 bytes for the Message metadata
     * length instead of 8.
     * @see https://issues.apache.org/jira/browse/ARROW-6313
     */
    writeLegacyIpcFormat?: boolean;
}
export declare class RecordBatchWriter<T extends TypeMap = any> extends ReadableInterop<Uint8Array> implements Writable<RecordBatch<T>> {
    /** @nocollapse */
    static throughNode(options?: DuplexOptions & {
        autoDestroy: boolean;
    }): Duplex;
    /** @nocollapse */
    static throughDOM<T extends TypeMap>(writableStrategy?: QueuingStrategy<RecordBatch<T>> & {
        autoDestroy: boolean;
    }, readableStrategy?: {
        highWaterMark?: number;
        size?: any;
    }): {
        writable: WritableStream<Table<T> | RecordBatch<T>>;
        readable: ReadableStream<Uint8Array>;
    };
    constructor(options?: RecordBatchStreamWriterOptions);
    protected _position: number;
    protected _started: boolean;
    protected _autoDestroy: boolean;
    protected _writeLegacyIpcFormat: boolean;
    protected _sink: AsyncByteQueue<Uint8Array>;
    protected _schema: Schema | null;
    protected _dictionaryBlocks: FileBlock[];
    protected _recordBatchBlocks: FileBlock[];
    protected _seenDictionaries: Map<number, Vector<any>>;
    protected _dictionaryDeltaOffsets: Map<number, number>;
    toString(sync: true): string;
    toString(sync?: false): Promise<string>;
    toUint8Array(sync: true): Uint8Array;
    toUint8Array(sync?: false): Promise<Uint8Array>;
    writeAll(input: Table<T> | Iterable<RecordBatch<T>>): this;
    writeAll(input: AsyncIterable<RecordBatch<T>>): Promise<this>;
    writeAll(input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<this>;
    writeAll(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<this>;
    get closed(): Promise<void>;
    [Symbol.asyncIterator](): AsyncByteQueue<Uint8Array>;
    toDOMStream(options?: ReadableDOMStreamOptions): ReadableStream<Uint8Array>;
    toNodeStream(options?: ReadableOptions): import("stream").Readable;
    close(): void;
    abort(reason?: any): void;
    finish(): this;
    reset(sink?: WritableSink<ArrayBufferViewInput>, schema?: Schema<T> | null): this;
    write(payload?: Table<T> | RecordBatch<T> | Iterable<RecordBatch<T>> | null): void;
    protected _writeMessage<T extends MessageHeader>(message: Message<T>, alignment?: number): this;
    protected _write(chunk: ArrayBufferViewInput): this;
    protected _writeSchema(schema: Schema<T>): this;
    protected _writeFooter(schema: Schema<T>): this;
    protected _writeMagic(): this;
    protected _writePadding(nBytes: number): this;
    protected _writeRecordBatch(batch: RecordBatch<T>): this;
    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta?: boolean): this;
    protected _writeBodyBuffers(buffers: ArrayBufferView[]): this;
    protected _writeDictionaries(batch: RecordBatch<T>): this;
}
/** @ignore */
export declare class RecordBatchStreamWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {
    static writeAll<T extends TypeMap = any>(input: Table<T> | Iterable<RecordBatch<T>>, options?: RecordBatchStreamWriterOptions): RecordBatchStreamWriter<T>;
    static writeAll<T extends TypeMap = any>(input: AsyncIterable<RecordBatch<T>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
    static writeAll<T extends TypeMap = any>(input: PromiseLike<AsyncIterable<RecordBatch<T>>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
    static writeAll<T extends TypeMap = any>(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
}
/** @ignore */
export declare class RecordBatchFileWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {
    static writeAll<T extends TypeMap = any>(input: Table<T> | Iterable<RecordBatch<T>>): RecordBatchFileWriter<T>;
    static writeAll<T extends TypeMap = any>(input: AsyncIterable<RecordBatch<T>>): Promise<RecordBatchFileWriter<T>>;
    static writeAll<T extends TypeMap = any>(input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<RecordBatchFileWriter<T>>;
    static writeAll<T extends TypeMap = any>(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<RecordBatchFileWriter<T>>;
    constructor();
    protected _writeSchema(schema: Schema<T>): this;
    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta?: boolean): this;
    protected _writeFooter(schema: Schema<T>): this;
}
/** @ignore */
export declare class RecordBatchJSONWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {
    static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: Table<T> | Iterable<RecordBatch<T>>): RecordBatchJSONWriter<T>;
    static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: AsyncIterable<RecordBatch<T>>): Promise<RecordBatchJSONWriter<T>>;
    static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<RecordBatchJSONWriter<T>>;
    static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<RecordBatchJSONWriter<T>>;
    private _recordBatches;
    private _recordBatchesWithDictionaries;
    constructor();
    protected _writeMessage(): this;
    protected _writeFooter(schema: Schema<T>): this;
    protected _writeSchema(schema: Schema<T>): this;
    protected _writeDictionaries(batch: RecordBatch<T>): this;
    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta?: boolean): this;
    protected _writeRecordBatch(batch: RecordBatch<T>): this;
    close(): void;
}
