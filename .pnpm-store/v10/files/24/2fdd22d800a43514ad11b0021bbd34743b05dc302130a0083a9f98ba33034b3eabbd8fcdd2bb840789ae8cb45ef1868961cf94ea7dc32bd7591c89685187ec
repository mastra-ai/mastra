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
import { __asyncValues, __awaiter } from "tslib";
import { Table } from '../table.mjs';
import { MAGIC } from './message.mjs';
import { Vector } from '../vector.mjs';
import { DataType } from '../type.mjs';
import { Message } from './metadata/message.mjs';
import * as metadata from './metadata/message.mjs';
import { FileBlock, Footer } from './metadata/file.mjs';
import { MessageHeader, MetadataVersion } from '../enum.mjs';
import { compareSchemas } from '../visitor/typecomparator.mjs';
import { AsyncByteQueue } from '../io/stream.mjs';
import { VectorAssembler } from '../visitor/vectorassembler.mjs';
import { JSONTypeAssembler } from '../visitor/jsontypeassembler.mjs';
import { JSONVectorAssembler } from '../visitor/jsonvectorassembler.mjs';
import { toUint8Array } from '../util/buffer.mjs';
import { RecordBatch, _InternalEmptyPlaceholderRecordBatch } from '../recordbatch.mjs';
import { ReadableInterop } from '../io/interfaces.mjs';
import { isPromise, isAsyncIterable, isWritableDOMStream, isWritableNodeStream, isIterable, isObject } from '../util/compat.mjs';
export class RecordBatchWriter extends ReadableInterop {
    /** @nocollapse */
    // @ts-ignore
    static throughNode(options) {
        throw new Error(`"throughNode" not available in this environment`);
    }
    /** @nocollapse */
    static throughDOM(
    // @ts-ignore
    writableStrategy, 
    // @ts-ignore
    readableStrategy) {
        throw new Error(`"throughDOM" not available in this environment`);
    }
    constructor(options) {
        super();
        this._position = 0;
        this._started = false;
        // @ts-ignore
        this._sink = new AsyncByteQueue();
        this._schema = null;
        this._dictionaryBlocks = [];
        this._recordBatchBlocks = [];
        this._seenDictionaries = new Map();
        this._dictionaryDeltaOffsets = new Map();
        isObject(options) || (options = { autoDestroy: true, writeLegacyIpcFormat: false });
        this._autoDestroy = (typeof options.autoDestroy === 'boolean') ? options.autoDestroy : true;
        this._writeLegacyIpcFormat = (typeof options.writeLegacyIpcFormat === 'boolean') ? options.writeLegacyIpcFormat : false;
    }
    toString(sync = false) {
        return this._sink.toString(sync);
    }
    toUint8Array(sync = false) {
        return this._sink.toUint8Array(sync);
    }
    writeAll(input) {
        if (isPromise(input)) {
            return input.then((x) => this.writeAll(x));
        }
        else if (isAsyncIterable(input)) {
            return writeAllAsync(this, input);
        }
        return writeAll(this, input);
    }
    get closed() { return this._sink.closed; }
    [Symbol.asyncIterator]() { return this._sink[Symbol.asyncIterator](); }
    toDOMStream(options) { return this._sink.toDOMStream(options); }
    toNodeStream(options) { return this._sink.toNodeStream(options); }
    close() {
        return this.reset()._sink.close();
    }
    abort(reason) {
        return this.reset()._sink.abort(reason);
    }
    finish() {
        this._autoDestroy ? this.close() : this.reset(this._sink, this._schema);
        return this;
    }
    reset(sink = this._sink, schema = null) {
        if ((sink === this._sink) || (sink instanceof AsyncByteQueue)) {
            this._sink = sink;
        }
        else {
            this._sink = new AsyncByteQueue();
            if (sink && isWritableDOMStream(sink)) {
                this.toDOMStream({ type: 'bytes' }).pipeTo(sink);
            }
            else if (sink && isWritableNodeStream(sink)) {
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
            }
            else {
                this._started = true;
                this._schema = schema;
                this._writeSchema(schema);
            }
        }
        return this;
    }
    write(payload) {
        let schema = null;
        if (!this._sink) {
            throw new Error(`RecordBatchWriter is closed`);
        }
        else if (payload == null) {
            return this.finish() && undefined;
        }
        else if (payload instanceof Table && !(schema = payload.schema)) {
            return this.finish() && undefined;
        }
        else if (payload instanceof RecordBatch && !(schema = payload.schema)) {
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
        }
        else if (payload instanceof Table) {
            this.writeAll(payload.batches);
        }
        else if (isIterable(payload)) {
            this.writeAll(payload);
        }
    }
    _writeMessage(message, alignment = 8) {
        const a = alignment - 1;
        const buffer = Message.encode(message);
        const flatbufferSize = buffer.byteLength;
        const prefixSize = !this._writeLegacyIpcFormat ? 8 : 4;
        const alignedSize = (flatbufferSize + prefixSize + a) & ~a;
        const nPaddingBytes = alignedSize - flatbufferSize - prefixSize;
        if (message.headerType === MessageHeader.RecordBatch) {
            this._recordBatchBlocks.push(new FileBlock(alignedSize, message.bodyLength, this._position));
        }
        else if (message.headerType === MessageHeader.DictionaryBatch) {
            this._dictionaryBlocks.push(new FileBlock(alignedSize, message.bodyLength, this._position));
        }
        // If not in legacy pre-0.15.0 mode, write the stream continuation indicator
        if (!this._writeLegacyIpcFormat) {
            this._write(Int32Array.of(-1));
        }
        // Write the flatbuffer size prefix including padding
        this._write(Int32Array.of(alignedSize - prefixSize));
        // Write the flatbuffer
        if (flatbufferSize > 0) {
            this._write(buffer);
        }
        // Write any padding
        return this._writePadding(nPaddingBytes);
    }
    _write(chunk) {
        if (this._started) {
            const buffer = toUint8Array(chunk);
            if (buffer && buffer.byteLength > 0) {
                this._sink.write(buffer);
                this._position += buffer.byteLength;
            }
        }
        return this;
    }
    _writeSchema(schema) {
        return this._writeMessage(Message.from(schema));
    }
    // @ts-ignore
    _writeFooter(schema) {
        // eos bytes
        return this._writeLegacyIpcFormat
            ? this._write(Int32Array.of(0))
            : this._write(Int32Array.of(-1, 0));
    }
    _writeMagic() {
        return this._write(MAGIC);
    }
    _writePadding(nBytes) {
        return nBytes > 0 ? this._write(new Uint8Array(nBytes)) : this;
    }
    _writeRecordBatch(batch) {
        const { byteLength, nodes, bufferRegions, buffers } = VectorAssembler.assemble(batch);
        const recordBatch = new metadata.RecordBatch(batch.numRows, nodes, bufferRegions);
        const message = Message.from(recordBatch, byteLength);
        return this
            ._writeDictionaries(batch)
            ._writeMessage(message)
            ._writeBodyBuffers(buffers);
    }
    _writeDictionaryBatch(dictionary, id, isDelta = false) {
        const { byteLength, nodes, bufferRegions, buffers } = VectorAssembler.assemble(new Vector([dictionary]));
        const recordBatch = new metadata.RecordBatch(dictionary.length, nodes, bufferRegions);
        const dictionaryBatch = new metadata.DictionaryBatch(recordBatch, id, isDelta);
        const message = Message.from(dictionaryBatch, byteLength);
        return this
            ._writeMessage(message)
            ._writeBodyBuffers(buffers);
    }
    _writeBodyBuffers(buffers) {
        let buffer;
        let size, padding;
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
    _writeDictionaries(batch) {
        var _a, _b;
        for (const [id, dictionary] of batch.dictionaries) {
            const chunks = (_a = dictionary === null || dictionary === void 0 ? void 0 : dictionary.data) !== null && _a !== void 0 ? _a : [];
            const prevDictionary = this._seenDictionaries.get(id);
            const offset = (_b = this._dictionaryDeltaOffsets.get(id)) !== null && _b !== void 0 ? _b : 0;
            // * If no previous dictionary was written, write an initial DictionaryMessage.
            // * If the current dictionary does not share chunks with the previous dictionary, write a replacement DictionaryMessage.
            if (!prevDictionary || prevDictionary.data[0] !== chunks[0]) {
                // * If `index > 0`, then `isDelta` is true.
                // * If `index = 0`, then `isDelta` is false, because this is either the initial or a replacement DictionaryMessage.
                for (const [index, chunk] of chunks.entries())
                    this._writeDictionaryBatch(chunk, id, index > 0);
            }
            else if (offset < chunks.length) {
                for (const chunk of chunks.slice(offset))
                    this._writeDictionaryBatch(chunk, id, true);
            }
            this._seenDictionaries.set(id, dictionary);
            this._dictionaryDeltaOffsets.set(id, chunks.length);
        }
        return this;
    }
}
/** @ignore */
export class RecordBatchStreamWriter extends RecordBatchWriter {
    /** @nocollapse */
    static writeAll(input, options) {
        const writer = new RecordBatchStreamWriter(options);
        if (isPromise(input)) {
            return input.then((x) => writer.writeAll(x));
        }
        else if (isAsyncIterable(input)) {
            return writeAllAsync(writer, input);
        }
        return writeAll(writer, input);
    }
}
/** @ignore */
export class RecordBatchFileWriter extends RecordBatchWriter {
    /** @nocollapse */
    static writeAll(input) {
        const writer = new RecordBatchFileWriter();
        if (isPromise(input)) {
            return input.then((x) => writer.writeAll(x));
        }
        else if (isAsyncIterable(input)) {
            return writeAllAsync(writer, input);
        }
        return writeAll(writer, input);
    }
    constructor() {
        super();
        this._autoDestroy = true;
    }
    // @ts-ignore
    _writeSchema(schema) {
        return this._writeMagic()._writePadding(2);
    }
    _writeDictionaryBatch(dictionary, id, isDelta = false) {
        if (!isDelta && this._seenDictionaries.has(id)) {
            throw new Error('The Arrow File format does not support replacement dictionaries. ');
        }
        return super._writeDictionaryBatch(dictionary, id, isDelta);
    }
    _writeFooter(schema) {
        const buffer = Footer.encode(new Footer(schema, MetadataVersion.V5, this._recordBatchBlocks, this._dictionaryBlocks));
        return super
            ._writeFooter(schema) // EOS bytes for sequential readers
            ._write(buffer) // Write the flatbuffer
            ._write(Int32Array.of(buffer.byteLength)) // then the footer size suffix
            ._writeMagic(); // then the magic suffix
    }
}
/** @ignore */
export class RecordBatchJSONWriter extends RecordBatchWriter {
    /** @nocollapse */
    static writeAll(input) {
        return new RecordBatchJSONWriter().writeAll(input);
    }
    constructor() {
        super();
        this._autoDestroy = true;
        this._recordBatches = [];
        this._recordBatchesWithDictionaries = [];
    }
    _writeMessage() { return this; }
    // @ts-ignore
    _writeFooter(schema) { return this; }
    _writeSchema(schema) {
        return this._write(`{\n  "schema": ${JSON.stringify({ fields: schema.fields.map(field => fieldToJSON(field)) }, null, 2)}`);
    }
    _writeDictionaries(batch) {
        if (batch.dictionaries.size > 0) {
            this._recordBatchesWithDictionaries.push(batch);
        }
        return this;
    }
    _writeDictionaryBatch(dictionary, id, isDelta = false) {
        this._write(this._dictionaryBlocks.length === 0 ? `    ` : `,\n    `);
        this._write(dictionaryBatchToJSON(dictionary, id, isDelta));
        this._dictionaryBlocks.push(new FileBlock(0, 0, 0));
        return this;
    }
    _writeRecordBatch(batch) {
        this._writeDictionaries(batch);
        this._recordBatches.push(batch);
        return this;
    }
    close() {
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
function writeAll(writer, input) {
    let chunks = input;
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
function writeAllAsync(writer, batches) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, batches_1, batches_1_1;
        var _b, e_1, _c, _d;
        try {
            for (_a = true, batches_1 = __asyncValues(batches); batches_1_1 = yield batches_1.next(), _b = batches_1_1.done, !_b; _a = true) {
                _d = batches_1_1.value;
                _a = false;
                const batch = _d;
                writer.write(batch);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = batches_1.return)) yield _c.call(batches_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return writer.finish();
    });
}
/** @ignore */
function fieldToJSON({ name, type, nullable }) {
    const assembler = new JSONTypeAssembler();
    return {
        'name': name, 'nullable': nullable,
        'type': assembler.visit(type),
        'children': (type.children || []).map((field) => fieldToJSON(field)),
        'dictionary': !DataType.isDictionary(type) ? undefined : {
            'id': type.id,
            'isOrdered': type.isOrdered,
            'indexType': assembler.visit(type.indices)
        }
    };
}
/** @ignore */
function dictionaryBatchToJSON(dictionary, id, isDelta = false) {
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
function recordBatchToJSON(records) {
    const [columns] = JSONVectorAssembler.assemble(records);
    return JSON.stringify({
        'count': records.numRows,
        'columns': columns
    }, null, 2);
}

//# sourceMappingURL=writer.mjs.map
