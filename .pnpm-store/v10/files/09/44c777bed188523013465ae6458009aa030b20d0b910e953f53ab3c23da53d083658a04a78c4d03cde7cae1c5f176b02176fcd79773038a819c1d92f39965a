/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { Vector } from '../vector.js';
import { DataType, TypeMap } from '../type.js';
import { MessageHeader } from '../enum.js';
import { Footer } from './metadata/file.js';
import { Schema, Field } from '../schema.js';
import { Message } from './metadata/message.js';
import * as metadata from './metadata/message.js';
import { ArrayBufferViewInput } from '../util/buffer.js';
import { ByteStream, AsyncByteStream } from '../io/stream.js';
import { RandomAccessFile, AsyncRandomAccessFile } from '../io/file.js';
import { RecordBatch } from '../recordbatch.js';
import { FileHandle, ArrowJSONLike, ReadableInterop } from '../io/interfaces.js';
import { MessageReader, AsyncMessageReader } from './message.js';
import type { DuplexOptions, Duplex } from 'node:stream';
/** @ignore */ export type FromArg0 = ArrowJSONLike;
/** @ignore */ export type FromArg1 = PromiseLike<ArrowJSONLike>;
/** @ignore */ export type FromArg2 = Iterable<ArrayBufferViewInput> | ArrayBufferViewInput;
/** @ignore */ export type FromArg3 = PromiseLike<Iterable<ArrayBufferViewInput> | ArrayBufferViewInput>;
/** @ignore */ export type FromArg4 = Response | NodeJS.ReadableStream | ReadableStream<ArrayBufferViewInput> | AsyncIterable<ArrayBufferViewInput>;
/** @ignore */ export type FromArg5 = FileHandle | PromiseLike<FileHandle> | PromiseLike<FromArg4>;
/** @ignore */ export type FromArgs = FromArg0 | FromArg1 | FromArg2 | FromArg3 | FromArg4 | FromArg5;
/** @ignore */ type OpenOptions = {
    autoDestroy?: boolean;
};
/** @ignore */ type RecordBatchReaders<T extends TypeMap = any> = RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
/** @ignore */ type AsyncRecordBatchReaders<T extends TypeMap = any> = AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>;
/** @ignore */ type RecordBatchFileReaders<T extends TypeMap = any> = RecordBatchFileReader<T> | AsyncRecordBatchFileReader<T>;
/** @ignore */ type RecordBatchStreamReaders<T extends TypeMap = any> = RecordBatchStreamReader<T> | AsyncRecordBatchStreamReader<T>;
export declare class RecordBatchReader<T extends TypeMap = any> extends ReadableInterop<RecordBatch<T>> {
    protected _impl: RecordBatchReaderImpls<T>;
    protected constructor(impl: RecordBatchReaderImpls<T>);
    get closed(): boolean;
    get schema(): Schema<T>;
    get autoDestroy(): boolean;
    get dictionaries(): Map<number, Vector<any>>;
    get numDictionaries(): number;
    get numRecordBatches(): number;
    get footer(): Footer | null;
    isSync(): this is RecordBatchReaders<T>;
    isAsync(): this is AsyncRecordBatchReaders<T>;
    isFile(): this is RecordBatchFileReaders<T>;
    isStream(): this is RecordBatchStreamReaders<T>;
    next(): Promise<any> | IteratorResult<RecordBatch<T>, any>;
    throw(value?: any): IteratorResult<any, any> | Promise<IteratorResult<any, any>>;
    return(value?: any): IteratorResult<any, any> | Promise<IteratorResult<any, any>>;
    cancel(): void | Promise<void>;
    reset(schema?: Schema<T> | null): this;
    open(options?: OpenOptions): this | Promise<this>;
    readRecordBatch(index: number): RecordBatch<T> | null | Promise<RecordBatch<T> | null>;
    [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
    toDOMStream(): ReadableStream<RecordBatch<T>>;
    toNodeStream(): import('stream').Readable;
    /** @nocollapse */
    static throughNode(options?: DuplexOptions & {
        autoDestroy: boolean;
    }): Duplex;
    /** @nocollapse */
    static throughDOM<T extends TypeMap>(writableStrategy?: ByteLengthQueuingStrategy, readableStrategy?: {
        autoDestroy: boolean;
    }): {
        writable: WritableStream<Uint8Array>;
        readable: ReadableStream<RecordBatch<T>>;
    };
    static from<T extends RecordBatchReader>(source: T): T;
    static from<T extends TypeMap = any>(source: FromArg0): RecordBatchStreamReader<T>;
    static from<T extends TypeMap = any>(source: FromArg1): Promise<RecordBatchStreamReader<T>>;
    static from<T extends TypeMap = any>(source: FromArg2): RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
    static from<T extends TypeMap = any>(source: FromArg3): Promise<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    static from<T extends TypeMap = any>(source: FromArg4): Promise<AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>>;
    static from<T extends TypeMap = any>(source: FromArg5): Promise<AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>>;
    static readAll<T extends RecordBatchReader>(source: T): T extends RecordBatchReaders ? IterableIterator<T> : AsyncIterableIterator<T>;
    static readAll<T extends TypeMap = any>(source: FromArg0): IterableIterator<RecordBatchStreamReader<T>>;
    static readAll<T extends TypeMap = any>(source: FromArg1): AsyncIterableIterator<RecordBatchStreamReader<T>>;
    static readAll<T extends TypeMap = any>(source: FromArg2): IterableIterator<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    static readAll<T extends TypeMap = any>(source: FromArg3): AsyncIterableIterator<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    static readAll<T extends TypeMap = any>(source: FromArg4): AsyncIterableIterator<AsyncRecordBatchReaders<T>>;
    static readAll<T extends TypeMap = any>(source: FromArg5): AsyncIterableIterator<AsyncRecordBatchReaders<T>>;
}
/** @ignore */
export declare class RecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    protected _impl: RecordBatchStreamReaderImpl<T>;
    constructor(_impl: RecordBatchStreamReaderImpl<T>);
    readAll(): RecordBatch<T>[];
    [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
export declare class AsyncRecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    protected _impl: AsyncRecordBatchStreamReaderImpl<T>;
    constructor(_impl: AsyncRecordBatchStreamReaderImpl<T>);
    readAll(): Promise<RecordBatch<T>[]>;
    [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
export declare class RecordBatchFileReader<T extends TypeMap = any> extends RecordBatchStreamReader<T> {
    protected _impl: RecordBatchFileReaderImpl<T>;
    constructor(_impl: RecordBatchFileReaderImpl<T>);
}
/** @ignore */
export declare class AsyncRecordBatchFileReader<T extends TypeMap = any> extends AsyncRecordBatchStreamReader<T> {
    protected _impl: AsyncRecordBatchFileReaderImpl<T>;
    constructor(_impl: AsyncRecordBatchFileReaderImpl<T>);
}
/** @ignore */
export interface RecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    open(options?: OpenOptions | undefined): this;
    cancel(): void;
    throw(value?: any): IteratorResult<any>;
    return(value?: any): IteratorResult<any>;
    next(value?: any): IteratorResult<RecordBatch<T>>;
}
/** @ignore */
export interface AsyncRecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    open(options?: OpenOptions | undefined): Promise<this>;
    cancel(): Promise<void>;
    throw(value?: any): Promise<IteratorResult<any>>;
    return(value?: any): Promise<IteratorResult<any>>;
    next(value?: any): Promise<IteratorResult<RecordBatch<T>>>;
}
/** @ignore */
export interface RecordBatchFileReader<T extends TypeMap = any> extends RecordBatchStreamReader<T> {
    readRecordBatch(index: number): RecordBatch<T> | null;
}
/** @ignore */
export interface AsyncRecordBatchFileReader<T extends TypeMap = any> extends AsyncRecordBatchStreamReader<T> {
    readRecordBatch(index: number): Promise<RecordBatch<T> | null>;
}
/** @ignore */
type RecordBatchReaderImpls<T extends TypeMap = any> = RecordBatchJSONReaderImpl<T> | RecordBatchFileReaderImpl<T> | RecordBatchStreamReaderImpl<T> | AsyncRecordBatchFileReaderImpl<T> | AsyncRecordBatchStreamReaderImpl<T>;
/** @ignore */
interface RecordBatchReaderImpl<T extends TypeMap = any> {
    closed: boolean;
    schema: Schema<T>;
    autoDestroy: boolean;
    dictionaries: Map<number, Vector>;
    isFile(): this is RecordBatchFileReaders<T>;
    isStream(): this is RecordBatchStreamReaders<T>;
    isSync(): this is RecordBatchReaders<T>;
    isAsync(): this is AsyncRecordBatchReaders<T>;
    reset(schema?: Schema<T> | null): this;
}
/** @ignore */
interface RecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> {
    open(options?: OpenOptions): this;
    cancel(): void;
    throw(value?: any): IteratorResult<any>;
    return(value?: any): IteratorResult<any>;
    next(value?: any): IteratorResult<RecordBatch<T>>;
    [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
}
/** @ignore */
interface AsyncRecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> {
    open(options?: OpenOptions): Promise<this>;
    cancel(): Promise<void>;
    throw(value?: any): Promise<IteratorResult<any>>;
    return(value?: any): Promise<IteratorResult<any>>;
    next(value?: any): Promise<IteratorResult<RecordBatch<T>>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
interface RecordBatchFileReaderImpl<T extends TypeMap = any> extends RecordBatchStreamReaderImpl<T> {
    readRecordBatch(index: number): RecordBatch<T> | null;
}
/** @ignore */
interface AsyncRecordBatchFileReaderImpl<T extends TypeMap = any> extends AsyncRecordBatchStreamReaderImpl<T> {
    readRecordBatch(index: number): Promise<RecordBatch<T> | null>;
}
/** @ignore */
declare abstract class RecordBatchReaderImpl<T extends TypeMap = any> implements RecordBatchReaderImpl<T> {
    schema: Schema<T>;
    closed: boolean;
    autoDestroy: boolean;
    dictionaries: Map<number, Vector>;
    protected _dictionaryIndex: number;
    protected _recordBatchIndex: number;
    get numDictionaries(): number;
    get numRecordBatches(): number;
    constructor(dictionaries?: Map<number, Vector<any>>);
    protected _loadRecordBatch(header: metadata.RecordBatch, body: any): RecordBatch<T>;
    protected _loadDictionaryBatch(header: metadata.DictionaryBatch, body: any): Vector<any>;
    protected _loadVectors(header: metadata.RecordBatch, body: any, types: (Field | DataType)[]): import("../data.js").Data<any>[];
}
/** @ignore */
declare class RecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> implements IterableIterator<RecordBatch<T>> {
    protected _reader: MessageReader;
    protected _handle: ByteStream | ArrowJSONLike;
    constructor(source: ByteStream | ArrowJSONLike, dictionaries?: Map<number, Vector>);
    isSync(): this is RecordBatchReaders<T>;
    isStream(): this is RecordBatchStreamReaders<T>;
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Message<T> | null;
}
/** @ignore */
declare class AsyncRecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> implements AsyncIterableIterator<RecordBatch<T>> {
    protected _handle: AsyncByteStream;
    protected _reader: AsyncMessageReader;
    constructor(source: AsyncByteStream, dictionaries?: Map<number, Vector>);
    isAsync(): this is AsyncRecordBatchReaders<T>;
    isStream(): this is RecordBatchStreamReaders<T>;
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Promise<Message<T> | null>;
}
/** @ignore */
declare class RecordBatchFileReaderImpl<T extends TypeMap = any> extends RecordBatchStreamReaderImpl<T> {
    protected _footer?: Footer;
    protected _handle: RandomAccessFile;
    get footer(): Footer;
    get numDictionaries(): number;
    get numRecordBatches(): number;
    constructor(source: RandomAccessFile | ArrayBufferViewInput, dictionaries?: Map<number, Vector>);
    isSync(): this is RecordBatchReaders<T>;
    isFile(): this is RecordBatchFileReaders<T>;
    open(options?: OpenOptions): this;
    protected _readDictionaryBatch(index: number): void;
    protected _readFooter(): Footer;
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Message<T> | null;
}
/** @ignore */
declare class AsyncRecordBatchFileReaderImpl<T extends TypeMap = any> extends AsyncRecordBatchStreamReaderImpl<T> implements AsyncRecordBatchFileReaderImpl<T> {
    protected _footer?: Footer;
    protected _handle: AsyncRandomAccessFile;
    get footer(): Footer;
    get numDictionaries(): number;
    get numRecordBatches(): number;
    constructor(source: FileHandle, byteLength?: number, dictionaries?: Map<number, Vector>);
    constructor(source: FileHandle | AsyncRandomAccessFile, dictionaries?: Map<number, Vector>);
    isFile(): this is RecordBatchFileReaders<T>;
    isAsync(): this is AsyncRecordBatchReaders<T>;
    open(options?: OpenOptions): Promise<this>;
    protected _readDictionaryBatch(index: number): Promise<void>;
    protected _readFooter(): Promise<Footer>;
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Promise<Message<T> | null>;
}
/** @ignore */
declare class RecordBatchJSONReaderImpl<T extends TypeMap = any> extends RecordBatchStreamReaderImpl<T> {
    constructor(source: ArrowJSONLike, dictionaries?: Map<number, Vector>);
    protected _loadVectors(header: metadata.RecordBatch, body: any, types: (Field | DataType)[]): import("../data.js").Data<any>[];
}
export {};
