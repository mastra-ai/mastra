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

import { Data } from '../data.js';
import { Table } from '../table.js';
import { MAGIC } from './message.js';
import { Vector } from '../vector.js';
import { DataType, TypeMap } from '../type.js';
import { Schema, Field } from '../schema.js';
import { Message } from './metadata/message.js';
import * as metadata from './metadata/message.js';
import { FileBlock, Footer } from './metadata/file.js';
import { MessageHeader, MetadataVersion } from '../enum.js';
import { compareSchemas } from '../visitor/typecomparator.js';
import { WritableSink, AsyncByteQueue } from '../io/stream.js';
import { VectorAssembler } from '../visitor/vectorassembler.js';
import { JSONTypeAssembler } from '../visitor/jsontypeassembler.js';
import { JSONVectorAssembler } from '../visitor/jsonvectorassembler.js';
import { ArrayBufferViewInput, toUint8Array } from '../util/buffer.js';
import { RecordBatch, _InternalEmptyPlaceholderRecordBatch } from '../recordbatch.js';
import { Writable, ReadableInterop, ReadableDOMStreamOptions } from '../io/interfaces.js';
import { isPromise, isAsyncIterable, isWritableDOMStream, isWritableNodeStream, isIterable, isObject } from '../util/compat.js';

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

export class RecordBatchWriter<T extends TypeMap = any> extends ReadableInterop<Uint8Array> implements Writable<RecordBatch<T>> {

    /** @nocollapse */
    // @ts-ignore
    public static throughNode(options?: DuplexOptions & { autoDestroy: boolean }): Duplex {
        throw new Error(`"throughNode" not available in this environment`);
    }
    /** @nocollapse */
    public static throughDOM<T extends TypeMap>(
        // @ts-ignore
        writableStrategy?: QueuingStrategy<RecordBatch<T>> & { autoDestroy: boolean },
        // @ts-ignore
        readableStrategy?: { highWaterMark?: number; size?: any }
    ): { writable: WritableStream<Table<T> | RecordBatch<T>>; readable: ReadableStream<Uint8Array> } {
        throw new Error(`"throughDOM" not available in this environment`);
    }

    constructor(options?: RecordBatchStreamWriterOptions) {
        super();
        isObject(options) || (options = { autoDestroy: true, writeLegacyIpcFormat: false });
        this._autoDestroy = (typeof options.autoDestroy === 'boolean') ? options.autoDestroy : true;
        this._writeLegacyIpcFormat = (typeof options.writeLegacyIpcFormat === 'boolean') ? options.writeLegacyIpcFormat : false;
    }

    protected _position = 0;
    protected _started = false;
    protected _autoDestroy: boolean;
    protected _writeLegacyIpcFormat: boolean;
    // @ts-ignore
    protected _sink = new AsyncByteQueue();
    protected _schema: Schema | null = null;
    protected _dictionaryBlocks: FileBlock[] = [];
    protected _recordBatchBlocks: FileBlock[] = [];
    protected _seenDictionaries = new Map<number, Vector>();
    protected _dictionaryDeltaOffsets = new Map<number, number>();

    public toString(sync: true): string;
    public toString(sync?: false): Promise<string>;
    public toString(sync: any = false) {
        return this._sink.toString(sync) as Promise<string> | string;
    }
    public toUint8Array(sync: true): Uint8Array;
    public toUint8Array(sync?: false): Promise<Uint8Array>;
    public toUint8Array(sync: any = false) {
        return this._sink.toUint8Array(sync) as Promise<Uint8Array> | Uint8Array;
    }

    public writeAll(input: Table<T> | Iterable<RecordBatch<T>>): this;
    public writeAll(input: AsyncIterable<RecordBatch<T>>): Promise<this>;
    public writeAll(input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<this>;
    public writeAll(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<this>;
    public writeAll(input: PromiseLike<any> | Table<T> | Iterable<RecordBatch<T>> | AsyncIterable<RecordBatch<T>>) {
        if (isPromise<any>(input)) {
            return input.then((x) => this.writeAll(x));
        } else if (isAsyncIterable<RecordBatch<T>>(input)) {
            return writeAllAsync(this, input);
        }
        return writeAll(this, <any>input);
    }

    public get closed() { return this._sink.closed; }
    public [Symbol.asyncIterator]() { return this._sink[Symbol.asyncIterator](); }
    public toDOMStream(options?: ReadableDOMStreamOptions) { return this._sink.toDOMStream(options); }
    public toNodeStream(options?: ReadableOptions) { return this._sink.toNodeStream(options); }

    public close() {
        return this.reset()._sink.close();
    }
    public abort(reason?: any) {
        return this.reset()._sink.abort(reason);
    }
    public finish() {
        this._autoDestroy ? this.close() : this.reset(this._sink, this._schema);
        return this;
    }
    public reset(sink: WritableSink<ArrayBufferViewInput> = this._sink, schema: Schema<T> | null = null) {
        if ((sink === this._sink) || (sink instanceof AsyncByteQueue)) {
            this._sink = sink as AsyncByteQueue;
        } else {
            this._sink = new AsyncByteQueue();
            if (sink && isWritableDOMStream(sink)) {
                this.toDOMStream({ type: 'bytes' }).pipeTo(sink);
            } else if (sink && isWritableNodeStream(sink)) {
                this.toNodeStream({ objectMode: false }).pipe(sink);
            }
        }

        if (this._started && this._schema) {
            this._writeFooter(this._schema);
        }

        this._started = false;
        this._dictionaryBlocks = [];
        this._recordBatchBlocks = [];
        this._seenDictionaries = new Map();
        this._dictionaryDeltaOffsets = new Map();

        if (!schema || !(compareSchemas(schema, this._schema))) {
            if (schema == null) {
                this._position = 0;
                this._schema = null;
            } else {
                this._started = true;
                this._schema = schema;
                this._writeSchema(schema);
            }
        }

        return this;
    }

    public write(payload?: Table<T> | RecordBatch<T> | Iterable<RecordBatch<T>> | null) {
        let schema: Schema<T> | null = null;

        if (!this._sink) {
            throw new Error(`RecordBatchWriter is closed`);
        } else if (payload == null) {
            return this.finish() && undefined;
        } else if (payload instanceof Table && !(schema = payload.schema)) {
            return this.finish() && undefined;
        } else if (payload instanceof RecordBatch && !(schema = payload.schema)) {
            return this.finish() && undefined;
        }

        if (schema && !compareSchemas(schema, this._schema)) {
            if (this._started && this._autoDestroy) {
                return this.close();
            }
            this.reset(this._sink, schema);
        }

        if (payload instanceof RecordBatch) {
            if (!(payload instanceof _InternalEmptyPlaceholderRecordBatch)) {
                this._writeRecordBatch(payload);
            }
        } else if (payload instanceof Table) {
            this.writeAll(payload.batches);
        } else if (isIterable(payload)) {
            this.writeAll(payload);
        }
    }

    protected _writeMessage<T extends MessageHeader>(message: Message<T>, alignment = 8) {
        const a = alignment - 1;
        const buffer = Message.encode(message);
        const flatbufferSize = buffer.byteLength;
        const prefixSize = !this._writeLegacyIpcFormat ? 8 : 4;
        const alignedSize = (flatbufferSize + prefixSize + a) & ~a;
        const nPaddingBytes = alignedSize - flatbufferSize - prefixSize;

        if (message.headerType === MessageHeader.RecordBatch) {
            this._recordBatchBlocks.push(new FileBlock(alignedSize, message.bodyLength, this._position));
        } else if (message.headerType === MessageHeader.DictionaryBatch) {
            this._dictionaryBlocks.push(new FileBlock(alignedSize, message.bodyLength, this._position));
        }

        // If not in legacy pre-0.15.0 mode, write the stream continuation indicator
        if (!this._writeLegacyIpcFormat) {
            this._write(Int32Array.of(-1));
        }
        // Write the flatbuffer size prefix including padding
        this._write(Int32Array.of(alignedSize - prefixSize));
        // Write the flatbuffer
        if (flatbufferSize > 0) { this._write(buffer); }
        // Write any padding
        return this._writePadding(nPaddingBytes);
    }

    protected _write(chunk: ArrayBufferViewInput) {
        if (this._started) {
            const buffer = toUint8Array(chunk);
            if (buffer && buffer.byteLength > 0) {
                this._sink.write(buffer);
                this._position += buffer.byteLength;
            }
        }
        return this;
    }

    protected _writeSchema(schema: Schema<T>) {
        return this._writeMessage(Message.from(schema));
    }

    // @ts-ignore
    protected _writeFooter(schema: Schema<T>) {
        // eos bytes
        return this._writeLegacyIpcFormat
            ? this._write(Int32Array.of(0))
            : this._write(Int32Array.of(-1, 0));
    }

    protected _writeMagic() {
        return this._write(MAGIC);
    }

    protected _writePadding(nBytes: number) {
        return nBytes > 0 ? this._write(new Uint8Array(nBytes)) : this;
    }

    protected _writeRecordBatch(batch: RecordBatch<T>) {
        const { byteLength, nodes, bufferRegions, buffers } = VectorAssembler.assemble(batch);
        const recordBatch = new metadata.RecordBatch(batch.numRows, nodes, bufferRegions);
        const message = Message.from(recordBatch, byteLength);
        return this
            ._writeDictionaries(batch)
            ._writeMessage(message)
            ._writeBodyBuffers(buffers);
    }

    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta = false) {
        const { byteLength, nodes, bufferRegions, buffers } = VectorAssembler.assemble(new Vector([dictionary]));
        const recordBatch = new metadata.RecordBatch(dictionary.length, nodes, bufferRegions);
        const dictionaryBatch = new metadata.DictionaryBatch(recordBatch, id, isDelta);
        const message = Message.from(dictionaryBatch, byteLength);
        return this
            ._writeMessage(message)
            ._writeBodyBuffers(buffers);
    }

    protected _writeBodyBuffers(buffers: ArrayBufferView[]) {
        let buffer: ArrayBufferView;
        let size: number, padding: number;
        for (let i = -1, n = buffers.length; ++i < n;) {
            if ((buffer = buffers[i]) && (size = buffer.byteLength) > 0) {
                this._write(buffer);
                if ((padding = ((size + 7) & ~7) - size) > 0) {
                    this._writePadding(padding);
                }
            }
        }
        return this;
    }

    protected _writeDictionaries(batch: RecordBatch<T>) {
        for (const [id, dictionary] of batch.dictionaries) {
            const chunks = dictionary?.data ?? [];
            const prevDictionary = this._seenDictionaries.get(id);
            const offset = this._dictionaryDeltaOffsets.get(id) ?? 0;
            // * If no previous dictionary was written, write an initial DictionaryMessage.
            // * If the current dictionary does not share chunks with the previous dictionary, write a replacement DictionaryMessage.
            if (!prevDictionary || prevDictionary.data[0] !== chunks[0]) {
                // * If `index > 0`, then `isDelta` is true.
                // * If `index = 0`, then `isDelta` is false, because this is either the initial or a replacement DictionaryMessage.
                for (const [index, chunk] of chunks.entries()) this._writeDictionaryBatch(chunk, id, index > 0);
            } else if (offset < chunks.length) {
                for (const chunk of chunks.slice(offset)) this._writeDictionaryBatch(chunk, id, true);
            }
            this._seenDictionaries.set(id, dictionary);
            this._dictionaryDeltaOffsets.set(id, chunks.length);
        }
        return this;
    }
}

/** @ignore */
export class RecordBatchStreamWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {
    public static writeAll<T extends TypeMap = any>(input: Table<T> | Iterable<RecordBatch<T>>, options?: RecordBatchStreamWriterOptions): RecordBatchStreamWriter<T>;
    public static writeAll<T extends TypeMap = any>(input: AsyncIterable<RecordBatch<T>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
    public static writeAll<T extends TypeMap = any>(input: PromiseLike<AsyncIterable<RecordBatch<T>>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
    public static writeAll<T extends TypeMap = any>(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>, options?: RecordBatchStreamWriterOptions): Promise<RecordBatchStreamWriter<T>>;
    /** @nocollapse */
    public static writeAll<T extends TypeMap = any>(input: any, options?: RecordBatchStreamWriterOptions) {
        const writer = new RecordBatchStreamWriter<T>(options);
        if (isPromise<any>(input)) {
            return input.then((x) => writer.writeAll(x));
        } else if (isAsyncIterable<RecordBatch<T>>(input)) {
            return writeAllAsync(writer, input);
        }
        return writeAll(writer, input);
    }
}

/** @ignore */
export class RecordBatchFileWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {
    public static writeAll<T extends TypeMap = any>(input: Table<T> | Iterable<RecordBatch<T>>): RecordBatchFileWriter<T>;
    public static writeAll<T extends TypeMap = any>(input: AsyncIterable<RecordBatch<T>>): Promise<RecordBatchFileWriter<T>>;
    public static writeAll<T extends TypeMap = any>(input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<RecordBatchFileWriter<T>>;
    public static writeAll<T extends TypeMap = any>(input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<RecordBatchFileWriter<T>>;
    /** @nocollapse */
    public static writeAll<T extends TypeMap = any>(input: any) {
        const writer = new RecordBatchFileWriter<T>();
        if (isPromise<any>(input)) {
            return input.then((x) => writer.writeAll(x));
        } else if (isAsyncIterable<RecordBatch<T>>(input)) {
            return writeAllAsync(writer, input);
        }
        return writeAll(writer, input);
    }

    constructor() {
        super();
        this._autoDestroy = true;
    }

    // @ts-ignore
    protected _writeSchema(schema: Schema<T>) {
        return this._writeMagic()._writePadding(2);
    }

    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta = false) {
        if (!isDelta && this._seenDictionaries.has(id)) {
            throw new Error('The Arrow File format does not support replacement dictionaries. ');
        }
        return super._writeDictionaryBatch(dictionary, id, isDelta);
    }

    protected _writeFooter(schema: Schema<T>) {
        const buffer = Footer.encode(new Footer(
            schema, MetadataVersion.V5,
            this._recordBatchBlocks, this._dictionaryBlocks
        ));
        return super
            ._writeFooter(schema) // EOS bytes for sequential readers
            ._write(buffer) // Write the flatbuffer
            ._write(Int32Array.of(buffer.byteLength)) // then the footer size suffix
            ._writeMagic(); // then the magic suffix
    }
}

/** @ignore */
export class RecordBatchJSONWriter<T extends TypeMap = any> extends RecordBatchWriter<T> {

    public static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: Table<T> | Iterable<RecordBatch<T>>): RecordBatchJSONWriter<T>;
    // @ts-ignore
    public static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: AsyncIterable<RecordBatch<T>>): Promise<RecordBatchJSONWriter<T>>;
    public static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: PromiseLike<AsyncIterable<RecordBatch<T>>>): Promise<RecordBatchJSONWriter<T>>;
    public static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: PromiseLike<Table<T> | Iterable<RecordBatch<T>>>): Promise<RecordBatchJSONWriter<T>>;
    /** @nocollapse */
    public static writeAll<T extends TypeMap = any>(this: typeof RecordBatchWriter, input: any) {
        return new RecordBatchJSONWriter<T>().writeAll(input as any);
    }

    private _recordBatches: RecordBatch[];
    private _recordBatchesWithDictionaries: RecordBatch[];

    constructor() {
        super();
        this._autoDestroy = true;
        this._recordBatches = [];
        this._recordBatchesWithDictionaries = [];
    }

    protected _writeMessage() { return this; }
    // @ts-ignore
    protected _writeFooter(schema: Schema<T>) { return this; }
    protected _writeSchema(schema: Schema<T>) {
        return this._write(`{\n  "schema": ${JSON.stringify({ fields: schema.fields.map(field => fieldToJSON(field)) }, null, 2)}`);
    }
    protected _writeDictionaries(batch: RecordBatch<T>) {
        if (batch.dictionaries.size > 0) {
            this._recordBatchesWithDictionaries.push(batch);
        }
        return this;
    }
    protected _writeDictionaryBatch(dictionary: Data, id: number, isDelta = false) {
        this._write(this._dictionaryBlocks.length === 0 ? `    ` : `,\n    `);
        this._write(dictionaryBatchToJSON(dictionary, id, isDelta));
        this._dictionaryBlocks.push(new FileBlock(0, 0, 0));
        return this;
    }
    protected _writeRecordBatch(batch: RecordBatch<T>) {
        this._writeDictionaries(batch);
        this._recordBatches.push(batch);
        return this;
    }
    public close() {
        if (this._recordBatchesWithDictionaries.length > 0) {
            this._write(`,\n  "dictionaries": [\n`);
            for (const batch of this._recordBatchesWithDictionaries) {
                super._writeDictionaries(batch);
            }
            this._write(`\n  ]`);
        }

        if (this._recordBatches.length > 0) {
            for (let i = -1, n = this._recordBatches.length; ++i < n;) {
                this._write(i === 0 ? `,\n  "batches": [\n    ` : `,\n    `);
                this._write(recordBatchToJSON(this._recordBatches[i]));
                this._recordBatchBlocks.push(new FileBlock(0, 0, 0));
            }
            this._write(`\n  ]`);
        }

        if (this._schema) {
            this._write(`\n}`);
        }

        this._recordBatchesWithDictionaries = [];
        this._recordBatches = [];

        return super.close();
    }
}

/** @ignore */
function writeAll<T extends TypeMap = any>(writer: RecordBatchWriter<T>, input: Table<T> | Iterable<RecordBatch<T>>) {
    let chunks = input as Iterable<RecordBatch<T>>;
    if (input instanceof Table) {
        chunks = input.batches;
        writer.reset(undefined, input.schema);
    }
    for (const batch of chunks) {
        writer.write(batch);
    }
    return writer.finish();
}

/** @ignore */
async function writeAllAsync<T extends TypeMap = any>(writer: RecordBatchWriter<T>, batches: AsyncIterable<RecordBatch<T>>) {
    for await (const batch of batches) {
        writer.write(batch);
    }
    return writer.finish();
}

/** @ignore */
function fieldToJSON({ name, type, nullable }: Field): Record<string, unknown> {
    const assembler = new JSONTypeAssembler();
    return {
        'name': name, 'nullable': nullable,
        'type': assembler.visit(type),
        'children': (type.children || []).map((field: any) => fieldToJSON(field)),
        'dictionary': !DataType.isDictionary(type) ? undefined : {
            'id': type.id,
            'isOrdered': type.isOrdered,
            'indexType': assembler.visit(type.indices)
        }
    };
}

/** @ignore */
function dictionaryBatchToJSON(dictionary: Data, id: number, isDelta = false) {
    const [columns] = JSONVectorAssembler.assemble(new RecordBatch({ [id]: dictionary }));
    return JSON.stringify({
        'id': id,
        'isDelta': isDelta,
        'data': {
            'count': dictionary.length,
            'columns': columns
        }
    }, null, 2);
}

/** @ignore */
function recordBatchToJSON(records: RecordBatch) {
    const [columns] = JSONVectorAssembler.assemble(records);
    return JSON.stringify({
        'count': records.numRows,
        'columns': columns
    }, null, 2);
}
