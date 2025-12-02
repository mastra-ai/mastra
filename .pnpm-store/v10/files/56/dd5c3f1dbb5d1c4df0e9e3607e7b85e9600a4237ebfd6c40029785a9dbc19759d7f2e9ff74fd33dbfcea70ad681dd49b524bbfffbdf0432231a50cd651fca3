// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { makeData } from '../data.js';
import { Vector } from '../vector.js';
import { DataType, Struct, TypeMap } from '../type.js';
import { MessageHeader } from '../enum.js';
import { Footer } from './metadata/file.js';
import { Schema, Field } from '../schema.js';
import streamAdapters from '../io/adapters.js';
import { Message } from './metadata/message.js';
import * as metadata from './metadata/message.js';
import { ArrayBufferViewInput } from '../util/buffer.js';
import { ByteStream, AsyncByteStream } from '../io/stream.js';
import { RandomAccessFile, AsyncRandomAccessFile } from '../io/file.js';
import { VectorLoader, JSONVectorLoader } from '../visitor/vectorloader.js';
import { RecordBatch, _InternalEmptyPlaceholderRecordBatch } from '../recordbatch.js';
import {
    FileHandle,
    ArrowJSONLike,
    ITERATOR_DONE,
    ReadableInterop,
} from '../io/interfaces.js';
import {
    MessageReader, AsyncMessageReader, JSONMessageReader,
    checkForMagicArrowString, magicLength, magicAndPadding, magicX2AndPadding
} from './message.js';
import {
    isPromise,
    isIterable, isAsyncIterable,
    isIteratorResult, isArrowJSON,
    isFileHandle, isFetchResponse,
    isReadableDOMStream, isReadableNodeStream
} from '../util/compat.js';

import type { DuplexOptions, Duplex } from 'node:stream';

/** @ignore */ export type FromArg0 = ArrowJSONLike;
/** @ignore */ export type FromArg1 = PromiseLike<ArrowJSONLike>;
/** @ignore */ export type FromArg2 = Iterable<ArrayBufferViewInput> | ArrayBufferViewInput;
/** @ignore */ export type FromArg3 = PromiseLike<Iterable<ArrayBufferViewInput> | ArrayBufferViewInput>;
/** @ignore */ export type FromArg4 = Response | NodeJS.ReadableStream | ReadableStream<ArrayBufferViewInput> | AsyncIterable<ArrayBufferViewInput>;
/** @ignore */ export type FromArg5 = FileHandle | PromiseLike<FileHandle> | PromiseLike<FromArg4>;
/** @ignore */ export type FromArgs = FromArg0 | FromArg1 | FromArg2 | FromArg3 | FromArg4 | FromArg5;

/** @ignore */ type OpenOptions = { autoDestroy?: boolean };
/** @ignore */ type RecordBatchReaders<T extends TypeMap = any> = RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
/** @ignore */ type AsyncRecordBatchReaders<T extends TypeMap = any> = AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>;
/** @ignore */ type RecordBatchFileReaders<T extends TypeMap = any> = RecordBatchFileReader<T> | AsyncRecordBatchFileReader<T>;
/** @ignore */ type RecordBatchStreamReaders<T extends TypeMap = any> = RecordBatchStreamReader<T> | AsyncRecordBatchStreamReader<T>;

export class RecordBatchReader<T extends TypeMap = any> extends ReadableInterop<RecordBatch<T>> {

    protected _impl: RecordBatchReaderImpls<T>;
    protected constructor(impl: RecordBatchReaderImpls<T>) {
        super();
        this._impl = impl;
    }

    public get closed() { return this._impl.closed; }
    public get schema() { return this._impl.schema; }
    public get autoDestroy() { return this._impl.autoDestroy; }
    public get dictionaries() { return this._impl.dictionaries; }
    public get numDictionaries() { return this._impl.numDictionaries; }
    public get numRecordBatches() { return this._impl.numRecordBatches; }
    public get footer(): Footer | null { return this._impl.isFile() ? this._impl.footer : null; }

    public isSync(): this is RecordBatchReaders<T> { return this._impl.isSync(); }
    public isAsync(): this is AsyncRecordBatchReaders<T> { return this._impl.isAsync(); }
    public isFile(): this is RecordBatchFileReaders<T> { return this._impl.isFile(); }
    public isStream(): this is RecordBatchStreamReaders<T> { return this._impl.isStream(); }

    public next() {
        return this._impl.next();
    }
    public throw(value?: any) {
        return this._impl.throw(value);
    }
    public return(value?: any) {
        return this._impl.return(value);
    }
    public cancel() {
        return this._impl.cancel();
    }
    public reset(schema?: Schema<T> | null): this {
        this._impl.reset(schema);
        this._DOMStream = undefined;
        this._nodeStream = undefined;
        return this;
    }
    public open(options?: OpenOptions) {
        const opening = this._impl.open(options);
        return isPromise(opening) ? opening.then(() => this) : this;
    }
    public readRecordBatch(index: number): RecordBatch<T> | null | Promise<RecordBatch<T> | null> {
        return this._impl.isFile() ? this._impl.readRecordBatch(index) : null;
    }
    public [Symbol.iterator](): IterableIterator<RecordBatch<T>> {
        return (<IterableIterator<RecordBatch<T>>>this._impl)[Symbol.iterator]();
    }
    public [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>> {
        return (<AsyncIterableIterator<RecordBatch<T>>>this._impl)[Symbol.asyncIterator]();
    }
    public toDOMStream(): ReadableStream<RecordBatch<T>> {
        return streamAdapters.toDOMStream<RecordBatch<T>>(
            (this.isSync()
                ? { [Symbol.iterator]: () => this } as Iterable<RecordBatch<T>>
                : { [Symbol.asyncIterator]: () => this } as AsyncIterable<RecordBatch<T>>));
    }
    public toNodeStream(): import('stream').Readable {
        return streamAdapters.toNodeStream<RecordBatch<T>>(
            (this.isSync()
                ? { [Symbol.iterator]: () => this } as Iterable<RecordBatch<T>>
                : { [Symbol.asyncIterator]: () => this } as AsyncIterable<RecordBatch<T>>),
            { objectMode: true });
    }

    /** @nocollapse */
    // @ts-ignore
    public static throughNode(options?: DuplexOptions & { autoDestroy: boolean }): Duplex {
        throw new Error(`"throughNode" not available in this environment`);
    }
    /** @nocollapse */
    public static throughDOM<T extends TypeMap>(
        // @ts-ignore
        writableStrategy?: ByteLengthQueuingStrategy,
        // @ts-ignore
        readableStrategy?: { autoDestroy: boolean }
    ): { writable: WritableStream<Uint8Array>; readable: ReadableStream<RecordBatch<T>> } {
        throw new Error(`"throughDOM" not available in this environment`);
    }

    public static from<T extends RecordBatchReader>(source: T): T;
    public static from<T extends TypeMap = any>(source: FromArg0): RecordBatchStreamReader<T>;
    public static from<T extends TypeMap = any>(source: FromArg1): Promise<RecordBatchStreamReader<T>>;
    public static from<T extends TypeMap = any>(source: FromArg2): RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
    public static from<T extends TypeMap = any>(source: FromArg3): Promise<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    public static from<T extends TypeMap = any>(source: FromArg4): Promise<AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>>;
    public static from<T extends TypeMap = any>(source: FromArg5): Promise<AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>>;
    /** @nocollapse */
    public static from<T extends TypeMap = any>(source: any) {
        if (source instanceof RecordBatchReader) {
            return source;
        } else if (isArrowJSON(source)) {
            return fromArrowJSON<T>(source);
        } else if (isFileHandle(source)) {
            return fromFileHandle<T>(source);
        } else if (isPromise<any>(source)) {
            return (async () => await RecordBatchReader.from<any>(await source))();
        } else if (isFetchResponse(source) || isReadableDOMStream(source) || isReadableNodeStream(source) || isAsyncIterable(source)) {
            return fromAsyncByteStream<T>(new AsyncByteStream(source));
        }
        return fromByteStream<T>(new ByteStream(source));
    }

    public static readAll<T extends RecordBatchReader>(source: T): T extends RecordBatchReaders ? IterableIterator<T> : AsyncIterableIterator<T>;
    public static readAll<T extends TypeMap = any>(source: FromArg0): IterableIterator<RecordBatchStreamReader<T>>;
    public static readAll<T extends TypeMap = any>(source: FromArg1): AsyncIterableIterator<RecordBatchStreamReader<T>>;
    public static readAll<T extends TypeMap = any>(source: FromArg2): IterableIterator<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    public static readAll<T extends TypeMap = any>(source: FromArg3): AsyncIterableIterator<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
    public static readAll<T extends TypeMap = any>(source: FromArg4): AsyncIterableIterator<AsyncRecordBatchReaders<T>>;
    public static readAll<T extends TypeMap = any>(source: FromArg5): AsyncIterableIterator<AsyncRecordBatchReaders<T>>;
    /** @nocollapse */
    public static readAll<T extends TypeMap = any>(source: any) {
        if (source instanceof RecordBatchReader) {
            return source.isSync() ? readAllSync(source) : readAllAsync(source as AsyncRecordBatchReaders<T>);
        } else if (isArrowJSON(source) || ArrayBuffer.isView(source) || isIterable<ArrayBufferViewInput>(source) || isIteratorResult(source)) {
            return readAllSync<T>(source) as IterableIterator<RecordBatchReaders<T>>;
        }
        return readAllAsync<T>(source) as AsyncIterableIterator<RecordBatchReaders<T> | AsyncRecordBatchReaders<T>>;
    }
}

//
// Since TS is a structural type system, we define the following subclass stubs
// so that concrete types exist to associate with the interfaces below.
//
// The implementation for each RecordBatchReader is hidden away in the set of
// `RecordBatchReaderImpl` classes in the second half of this file. This allows
// us to export a single RecordBatchReader class, and swap out the impl based
// on the io primitives or underlying arrow (JSON, file, or stream) at runtime.
//
// Async/await makes our job a bit harder, since it forces everything to be
// either fully sync or fully async. This is why the logic for the reader impls
// has been duplicated into both sync and async variants. Since the RBR
// delegates to its impl, an RBR with an AsyncRecordBatchFileReaderImpl for
// example will return async/await-friendly Promises, but one with a (sync)
// RecordBatchStreamReaderImpl will always return values. Nothing should be
// different about their logic, aside from the async handling. This is also why
// this code looks highly structured, as it should be nearly identical and easy
// to follow.
//

/** @ignore */
export class RecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    constructor(protected _impl: RecordBatchStreamReaderImpl<T>) { super(_impl); }
    public readAll() { return [...this]; }
    public [Symbol.iterator]() { return (this._impl as IterableIterator<RecordBatch<T>>)[Symbol.iterator](); }
    public async *[Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>> { yield* this[Symbol.iterator](); }
}
/** @ignore */
export class AsyncRecordBatchStreamReader<T extends TypeMap = any> extends RecordBatchReader<T> {
    constructor(protected _impl: AsyncRecordBatchStreamReaderImpl<T>) { super(_impl); }
    public async readAll() {
        const batches = new Array<RecordBatch<T>>();
        for await (const batch of this) { batches.push(batch); }
        return batches;
    }
    public [Symbol.iterator](): IterableIterator<RecordBatch<T>> { throw new Error(`AsyncRecordBatchStreamReader is not Iterable`); }
    public [Symbol.asyncIterator]() { return (this._impl as AsyncIterableIterator<RecordBatch<T>>)[Symbol.asyncIterator](); }
}
/** @ignore */
export class RecordBatchFileReader<T extends TypeMap = any> extends RecordBatchStreamReader<T> {
    constructor(protected _impl: RecordBatchFileReaderImpl<T>) { super(_impl); }
}
/** @ignore */
export class AsyncRecordBatchFileReader<T extends TypeMap = any> extends AsyncRecordBatchStreamReader<T> {
    constructor(protected _impl: AsyncRecordBatchFileReaderImpl<T>) { super(_impl); }
}

//
// Now override the return types for each sync/async RecordBatchReader variant
//

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
type RecordBatchReaderImpls<T extends TypeMap = any> =
    RecordBatchJSONReaderImpl<T> |
    RecordBatchFileReaderImpl<T> |
    RecordBatchStreamReaderImpl<T> |
    AsyncRecordBatchFileReaderImpl<T> |
    AsyncRecordBatchStreamReaderImpl<T>;

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
abstract class RecordBatchReaderImpl<T extends TypeMap = any> implements RecordBatchReaderImpl<T> {

    declare public schema: Schema<T>;
    public closed = false;
    public autoDestroy = true;
    public dictionaries: Map<number, Vector>;

    protected _dictionaryIndex = 0;
    protected _recordBatchIndex = 0;
    public get numDictionaries() { return this._dictionaryIndex; }
    public get numRecordBatches() { return this._recordBatchIndex; }

    constructor(dictionaries = new Map<number, Vector>()) {
        this.dictionaries = dictionaries;
    }

    public isSync(): this is RecordBatchReaders<T> { return false; }
    public isAsync(): this is AsyncRecordBatchReaders<T> { return false; }
    public isFile(): this is RecordBatchFileReaders<T> { return false; }
    public isStream(): this is RecordBatchStreamReaders<T> { return false; }

    public reset(schema?: Schema<T> | null) {
        this._dictionaryIndex = 0;
        this._recordBatchIndex = 0;
        this.schema = <any>schema;
        this.dictionaries = new Map();
        return this;
    }

    protected _loadRecordBatch(header: metadata.RecordBatch, body: any) {
        const children = this._loadVectors(header, body, this.schema.fields);
        const data = makeData({ type: new Struct(this.schema.fields), length: header.length, children });
        return new RecordBatch(this.schema, data);
    }
    protected _loadDictionaryBatch(header: metadata.DictionaryBatch, body: any) {
        const { id, isDelta } = header;
        const { dictionaries, schema } = this;
        const dictionary = dictionaries.get(id);
        const type = schema.dictionaries.get(id)!;
        const data = this._loadVectors(header.data, body, [type]);
        return (dictionary && isDelta ? dictionary.concat(
            new Vector(data)) :
            new Vector(data)).memoize() as Vector;
    }
    protected _loadVectors(header: metadata.RecordBatch, body: any, types: (Field | DataType)[]) {
        return new VectorLoader(body, header.nodes, header.buffers, this.dictionaries, this.schema.metadataVersion).visitMany(types);
    }
}

/** @ignore */
class RecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> implements IterableIterator<RecordBatch<T>> {

    protected _reader: MessageReader;
    protected _handle: ByteStream | ArrowJSONLike;

    constructor(source: ByteStream | ArrowJSONLike, dictionaries?: Map<number, Vector>) {
        super(dictionaries);
        this._reader = !isArrowJSON(source)
            ? new MessageReader(this._handle = source)
            : new JSONMessageReader(this._handle = source);
    }

    public isSync(): this is RecordBatchReaders<T> { return true; }
    public isStream(): this is RecordBatchStreamReaders<T> { return true; }
    public [Symbol.iterator](): IterableIterator<RecordBatch<T>> {
        return this as IterableIterator<RecordBatch<T>>;
    }
    public cancel() {
        if (!this.closed && (this.closed = true)) {
            this.reset()._reader.return();
            this._reader = <any>null;
            this.dictionaries = <any>null;
        }
    }
    public open(options?: OpenOptions) {
        if (!this.closed) {
            this.autoDestroy = shouldAutoDestroy(this, options);
            if (!(this.schema || (this.schema = this._reader.readSchema()!))) {
                this.cancel();
            }
        }
        return this;
    }
    public throw(value?: any): IteratorResult<any> {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return this.reset()._reader.throw(value);
        }
        return ITERATOR_DONE;
    }
    public return(value?: any): IteratorResult<any> {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return this.reset()._reader.return(value);
        }
        return ITERATOR_DONE;
    }
    public next(): IteratorResult<RecordBatch<T>> {
        if (this.closed) { return ITERATOR_DONE; }
        let message: Message | null;
        const { _reader: reader } = this;
        while (message = this._readNextMessageAndValidate()) {
            if (message.isSchema()) {
                this.reset(message.header());
            } else if (message.isRecordBatch()) {
                this._recordBatchIndex++;
                const header = message.header();
                const buffer = reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return { done: false, value: recordBatch };
            } else if (message.isDictionaryBatch()) {
                this._dictionaryIndex++;
                const header = message.header();
                const buffer = reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
        if (this.schema && this._recordBatchIndex === 0) {
            this._recordBatchIndex++;
            return { done: false, value: new _InternalEmptyPlaceholderRecordBatch<T>(this.schema) };
        }
        return this.return();
    }
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null) {
        return this._reader.readMessage<T>(type);
    }
}

/** @ignore */
class AsyncRecordBatchStreamReaderImpl<T extends TypeMap = any> extends RecordBatchReaderImpl<T> implements AsyncIterableIterator<RecordBatch<T>> {

    protected _handle: AsyncByteStream;
    protected _reader: AsyncMessageReader;

    constructor(source: AsyncByteStream, dictionaries?: Map<number, Vector>) {
        super(dictionaries);
        this._reader = new AsyncMessageReader(this._handle = source);
    }
    public isAsync(): this is AsyncRecordBatchReaders<T> { return true; }
    public isStream(): this is RecordBatchStreamReaders<T> { return true; }
    public [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>> {
        return this as AsyncIterableIterator<RecordBatch<T>>;
    }
    public async cancel() {
        if (!this.closed && (this.closed = true)) {
            await this.reset()._reader.return();
            this._reader = <any>null;
            this.dictionaries = <any>null;
        }
    }
    public async open(options?: OpenOptions) {
        if (!this.closed) {
            this.autoDestroy = shouldAutoDestroy(this, options);
            if (!(this.schema || (this.schema = (await this._reader.readSchema())!))) {
                await this.cancel();
            }
        }
        return this;
    }
    public async throw(value?: any): Promise<IteratorResult<any>> {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return await this.reset()._reader.throw(value);
        }
        return ITERATOR_DONE;
    }
    public async return(value?: any): Promise<IteratorResult<any>> {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return await this.reset()._reader.return(value);
        }
        return ITERATOR_DONE;
    }
    public async next() {
        if (this.closed) { return ITERATOR_DONE; }
        let message: Message | null;
        const { _reader: reader } = this;
        while (message = await this._readNextMessageAndValidate()) {
            if (message.isSchema()) {
                await this.reset(message.header());
            } else if (message.isRecordBatch()) {
                this._recordBatchIndex++;
                const header = message.header();
                const buffer = await reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return { done: false, value: recordBatch };
            } else if (message.isDictionaryBatch()) {
                this._dictionaryIndex++;
                const header = message.header();
                const buffer = await reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
        if (this.schema && this._recordBatchIndex === 0) {
            this._recordBatchIndex++;
            return { done: false, value: new _InternalEmptyPlaceholderRecordBatch<T>(this.schema) };
        }
        return await this.return();
    }
    protected async _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null) {
        return await this._reader.readMessage<T>(type);
    }
}

/** @ignore */
class RecordBatchFileReaderImpl<T extends TypeMap = any> extends RecordBatchStreamReaderImpl<T> {

    protected _footer?: Footer;
    declare protected _handle: RandomAccessFile;
    public get footer() { return this._footer!; }
    public get numDictionaries() { return this._footer ? this._footer.numDictionaries : 0; }
    public get numRecordBatches() { return this._footer ? this._footer.numRecordBatches : 0; }

    constructor(source: RandomAccessFile | ArrayBufferViewInput, dictionaries?: Map<number, Vector>) {
        super(source instanceof RandomAccessFile ? source : new RandomAccessFile(source), dictionaries);
    }
    public isSync(): this is RecordBatchReaders<T> { return true; }
    public isFile(): this is RecordBatchFileReaders<T> { return true; }
    public open(options?: OpenOptions) {
        if (!this.closed && !this._footer) {
            this.schema = (this._footer = this._readFooter()).schema;
            for (const block of this._footer.dictionaryBatches()) {
                block && this._readDictionaryBatch(this._dictionaryIndex++);
            }
        }
        return super.open(options);
    }
    public readRecordBatch(index: number) {
        if (this.closed) { return null; }
        if (!this._footer) { this.open(); }
        const block = this._footer?.getRecordBatch(index);
        if (block && this._handle.seek(block.offset)) {
            const message = this._reader.readMessage(MessageHeader.RecordBatch);
            if (message?.isRecordBatch()) {
                const header = message.header();
                const buffer = this._reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return recordBatch;
            }
        }
        return null;
    }
    protected _readDictionaryBatch(index: number) {
        const block = this._footer?.getDictionaryBatch(index);
        if (block && this._handle.seek(block.offset)) {
            const message = this._reader.readMessage(MessageHeader.DictionaryBatch);
            if (message?.isDictionaryBatch()) {
                const header = message.header();
                const buffer = this._reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
    }
    protected _readFooter() {
        const { _handle } = this;
        const offset = _handle.size - magicAndPadding;
        const length = _handle.readInt32(offset);
        const buffer = _handle.readAt(offset - length, length);
        return Footer.decode(buffer);
    }
    protected _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Message<T> | null {
        if (!this._footer) { this.open(); }
        if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
            const block = this._footer?.getRecordBatch(this._recordBatchIndex);
            if (block && this._handle.seek(block.offset)) {
                return this._reader.readMessage(type);
            }
        }
        return null;
    }
}

/** @ignore */
class AsyncRecordBatchFileReaderImpl<T extends TypeMap = any> extends AsyncRecordBatchStreamReaderImpl<T>
    implements AsyncRecordBatchFileReaderImpl<T> {

    protected _footer?: Footer;
    declare protected _handle: AsyncRandomAccessFile;
    public get footer() { return this._footer!; }
    public get numDictionaries() { return this._footer ? this._footer.numDictionaries : 0; }
    public get numRecordBatches() { return this._footer ? this._footer.numRecordBatches : 0; }

    constructor(source: FileHandle, byteLength?: number, dictionaries?: Map<number, Vector>);
    constructor(source: FileHandle | AsyncRandomAccessFile, dictionaries?: Map<number, Vector>);
    constructor(source: FileHandle | AsyncRandomAccessFile, ...rest: any[]) {
        const byteLength = typeof rest[0] !== 'number' ? <number>rest.shift() : undefined;
        const dictionaries = rest[0] instanceof Map ? <Map<number, Vector>>rest.shift() : undefined;
        super(source instanceof AsyncRandomAccessFile ? source : new AsyncRandomAccessFile(source, byteLength), dictionaries);
    }
    public isFile(): this is RecordBatchFileReaders<T> { return true; }
    public isAsync(): this is AsyncRecordBatchReaders<T> { return true; }
    public async open(options?: OpenOptions) {
        if (!this.closed && !this._footer) {
            this.schema = (this._footer = await this._readFooter()).schema;
            for (const block of this._footer.dictionaryBatches()) {
                block && await this._readDictionaryBatch(this._dictionaryIndex++);
            }
        }
        return await super.open(options);
    }
    public async readRecordBatch(index: number) {
        if (this.closed) { return null; }
        if (!this._footer) { await this.open(); }
        const block = this._footer?.getRecordBatch(index);
        if (block && (await this._handle.seek(block.offset))) {
            const message = await this._reader.readMessage(MessageHeader.RecordBatch);
            if (message?.isRecordBatch()) {
                const header = message.header();
                const buffer = await this._reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return recordBatch;
            }
        }
        return null;
    }
    protected async _readDictionaryBatch(index: number) {
        const block = this._footer?.getDictionaryBatch(index);
        if (block && (await this._handle.seek(block.offset))) {
            const message = await this._reader.readMessage(MessageHeader.DictionaryBatch);
            if (message?.isDictionaryBatch()) {
                const header = message.header();
                const buffer = await this._reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
    }
    protected async _readFooter() {
        const { _handle } = this;
        _handle._pending && await _handle._pending;
        const offset = _handle.size - magicAndPadding;
        const length = await _handle.readInt32(offset);
        const buffer = await _handle.readAt(offset - length, length);
        return Footer.decode(buffer);
    }
    protected async _readNextMessageAndValidate<T extends MessageHeader>(type?: T | null): Promise<Message<T> | null> {
        if (!this._footer) { await this.open(); }
        if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
            const block = this._footer.getRecordBatch(this._recordBatchIndex);
            if (block && await this._handle.seek(block.offset)) {
                return await this._reader.readMessage(type);
            }
        }
        return null;
    }
}

/** @ignore */
class RecordBatchJSONReaderImpl<T extends TypeMap = any> extends RecordBatchStreamReaderImpl<T> {
    constructor(source: ArrowJSONLike, dictionaries?: Map<number, Vector>) {
        super(source, dictionaries);
    }
    protected _loadVectors(header: metadata.RecordBatch, body: any, types: (Field | DataType)[]) {
        return new JSONVectorLoader(body, header.nodes, header.buffers, this.dictionaries, this.schema.metadataVersion).visitMany(types);
    }
}

//
// Define some helper functions and static implementations down here. There's
// a bit of branching in the static methods that can lead to the same routines
// being executed, so we've broken those out here for readability.
//

/** @ignore */
function shouldAutoDestroy(self: { autoDestroy: boolean }, options?: OpenOptions) {
    return options && (typeof options['autoDestroy'] === 'boolean') ? options['autoDestroy'] : self['autoDestroy'];
}

/** @ignore */
function* readAllSync<T extends TypeMap = any>(source: RecordBatchReaders<T> | FromArg0 | FromArg2) {
    const reader = RecordBatchReader.from<T>(<any>source) as RecordBatchReaders<T>;
    try {
        if (!reader.open({ autoDestroy: false }).closed) {
            do { yield reader; } while (!(reader.reset().open()).closed);
        }
    } finally { reader.cancel(); }
}

/** @ignore */
async function* readAllAsync<T extends TypeMap = any>(source: AsyncRecordBatchReaders<T> | FromArg1 | FromArg3 | FromArg4 | FromArg5) {
    const reader = await RecordBatchReader.from<T>(<any>source) as RecordBatchReader<T>;
    try {
        if (!(await reader.open({ autoDestroy: false })).closed) {
            do { yield reader; } while (!(await reader.reset().open()).closed);
        }
    } finally { await reader.cancel(); }
}

/** @ignore */
function fromArrowJSON<T extends TypeMap>(source: ArrowJSONLike) {
    return new RecordBatchStreamReader(new RecordBatchJSONReaderImpl<T>(source));
}

/** @ignore */
function fromByteStream<T extends TypeMap>(source: ByteStream) {
    const bytes = source.peek((magicLength + 7) & ~7);
    return bytes && bytes.byteLength >= 4 ? !checkForMagicArrowString(bytes)
        ? new RecordBatchStreamReader(new RecordBatchStreamReaderImpl<T>(source))
        : new RecordBatchFileReader(new RecordBatchFileReaderImpl<T>(source.read()))
        : new RecordBatchStreamReader(new RecordBatchStreamReaderImpl<T>(function* (): any { }()));
}

/** @ignore */
async function fromAsyncByteStream<T extends TypeMap>(source: AsyncByteStream) {
    const bytes = await source.peek((magicLength + 7) & ~7);
    return bytes && bytes.byteLength >= 4 ? !checkForMagicArrowString(bytes)
        ? new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl<T>(source))
        : new RecordBatchFileReader(new RecordBatchFileReaderImpl<T>(await source.read()))
        : new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl<T>(async function* (): any { }()));
}

/** @ignore */
async function fromFileHandle<T extends TypeMap>(source: FileHandle) {
    const { size } = await source.stat();
    const file = new AsyncRandomAccessFile(source, size);
    if (size >= magicX2AndPadding && checkForMagicArrowString(await file.readAt(0, (magicLength + 7) & ~7))) {
        return new AsyncRecordBatchFileReader(new AsyncRecordBatchFileReaderImpl<T>(file));
    }
    return new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl<T>(file));
}
