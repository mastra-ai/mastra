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
import { __asyncDelegator, __asyncGenerator, __asyncValues, __await, __awaiter } from "tslib";
import { makeData } from '../data.mjs';
import { Vector } from '../vector.mjs';
import { Struct } from '../type.mjs';
import { MessageHeader } from '../enum.mjs';
import { Footer } from './metadata/file.mjs';
import streamAdapters from '../io/adapters.mjs';
import { ByteStream, AsyncByteStream } from '../io/stream.mjs';
import { RandomAccessFile, AsyncRandomAccessFile } from '../io/file.mjs';
import { VectorLoader, JSONVectorLoader } from '../visitor/vectorloader.mjs';
import { RecordBatch, _InternalEmptyPlaceholderRecordBatch } from '../recordbatch.mjs';
import { ITERATOR_DONE, ReadableInterop, } from '../io/interfaces.mjs';
import { MessageReader, AsyncMessageReader, JSONMessageReader, checkForMagicArrowString, magicLength, magicAndPadding, magicX2AndPadding } from './message.mjs';
import { isPromise, isIterable, isAsyncIterable, isIteratorResult, isArrowJSON, isFileHandle, isFetchResponse, isReadableDOMStream, isReadableNodeStream } from '../util/compat.mjs';
export class RecordBatchReader extends ReadableInterop {
    constructor(impl) {
        super();
        this._impl = impl;
    }
    get closed() { return this._impl.closed; }
    get schema() { return this._impl.schema; }
    get autoDestroy() { return this._impl.autoDestroy; }
    get dictionaries() { return this._impl.dictionaries; }
    get numDictionaries() { return this._impl.numDictionaries; }
    get numRecordBatches() { return this._impl.numRecordBatches; }
    get footer() { return this._impl.isFile() ? this._impl.footer : null; }
    isSync() { return this._impl.isSync(); }
    isAsync() { return this._impl.isAsync(); }
    isFile() { return this._impl.isFile(); }
    isStream() { return this._impl.isStream(); }
    next() {
        return this._impl.next();
    }
    throw(value) {
        return this._impl.throw(value);
    }
    return(value) {
        return this._impl.return(value);
    }
    cancel() {
        return this._impl.cancel();
    }
    reset(schema) {
        this._impl.reset(schema);
        this._DOMStream = undefined;
        this._nodeStream = undefined;
        return this;
    }
    open(options) {
        const opening = this._impl.open(options);
        return isPromise(opening) ? opening.then(() => this) : this;
    }
    readRecordBatch(index) {
        return this._impl.isFile() ? this._impl.readRecordBatch(index) : null;
    }
    [Symbol.iterator]() {
        return this._impl[Symbol.iterator]();
    }
    [Symbol.asyncIterator]() {
        return this._impl[Symbol.asyncIterator]();
    }
    toDOMStream() {
        return streamAdapters.toDOMStream((this.isSync()
            ? { [Symbol.iterator]: () => this }
            : { [Symbol.asyncIterator]: () => this }));
    }
    toNodeStream() {
        return streamAdapters.toNodeStream((this.isSync()
            ? { [Symbol.iterator]: () => this }
            : { [Symbol.asyncIterator]: () => this }), { objectMode: true });
    }
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
    /** @nocollapse */
    static from(source) {
        if (source instanceof RecordBatchReader) {
            return source;
        }
        else if (isArrowJSON(source)) {
            return fromArrowJSON(source);
        }
        else if (isFileHandle(source)) {
            return fromFileHandle(source);
        }
        else if (isPromise(source)) {
            return (() => __awaiter(this, void 0, void 0, function* () { return yield RecordBatchReader.from(yield source); }))();
        }
        else if (isFetchResponse(source) || isReadableDOMStream(source) || isReadableNodeStream(source) || isAsyncIterable(source)) {
            return fromAsyncByteStream(new AsyncByteStream(source));
        }
        return fromByteStream(new ByteStream(source));
    }
    /** @nocollapse */
    static readAll(source) {
        if (source instanceof RecordBatchReader) {
            return source.isSync() ? readAllSync(source) : readAllAsync(source);
        }
        else if (isArrowJSON(source) || ArrayBuffer.isView(source) || isIterable(source) || isIteratorResult(source)) {
            return readAllSync(source);
        }
        return readAllAsync(source);
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
export class RecordBatchStreamReader extends RecordBatchReader {
    constructor(_impl) {
        super(_impl);
        this._impl = _impl;
    }
    readAll() { return [...this]; }
    [Symbol.iterator]() { return this._impl[Symbol.iterator](); }
    [Symbol.asyncIterator]() { return __asyncGenerator(this, arguments, function* _a() { yield __await(yield* __asyncDelegator(__asyncValues(this[Symbol.iterator]()))); }); }
}
/** @ignore */
export class AsyncRecordBatchStreamReader extends RecordBatchReader {
    constructor(_impl) {
        super(_impl);
        this._impl = _impl;
    }
    readAll() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const batches = new Array();
            try {
                for (var _d = true, _e = __asyncValues(this), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const batch = _c;
                    batches.push(batch);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return batches;
        });
    }
    [Symbol.iterator]() { throw new Error(`AsyncRecordBatchStreamReader is not Iterable`); }
    [Symbol.asyncIterator]() { return this._impl[Symbol.asyncIterator](); }
}
/** @ignore */
export class RecordBatchFileReader extends RecordBatchStreamReader {
    constructor(_impl) {
        super(_impl);
        this._impl = _impl;
    }
}
/** @ignore */
export class AsyncRecordBatchFileReader extends AsyncRecordBatchStreamReader {
    constructor(_impl) {
        super(_impl);
        this._impl = _impl;
    }
}
/** @ignore */
class RecordBatchReaderImpl {
    get numDictionaries() { return this._dictionaryIndex; }
    get numRecordBatches() { return this._recordBatchIndex; }
    constructor(dictionaries = new Map()) {
        this.closed = false;
        this.autoDestroy = true;
        this._dictionaryIndex = 0;
        this._recordBatchIndex = 0;
        this.dictionaries = dictionaries;
    }
    isSync() { return false; }
    isAsync() { return false; }
    isFile() { return false; }
    isStream() { return false; }
    reset(schema) {
        this._dictionaryIndex = 0;
        this._recordBatchIndex = 0;
        this.schema = schema;
        this.dictionaries = new Map();
        return this;
    }
    _loadRecordBatch(header, body) {
        const children = this._loadVectors(header, body, this.schema.fields);
        const data = makeData({ type: new Struct(this.schema.fields), length: header.length, children });
        return new RecordBatch(this.schema, data);
    }
    _loadDictionaryBatch(header, body) {
        const { id, isDelta } = header;
        const { dictionaries, schema } = this;
        const dictionary = dictionaries.get(id);
        const type = schema.dictionaries.get(id);
        const data = this._loadVectors(header.data, body, [type]);
        return (dictionary && isDelta ? dictionary.concat(new Vector(data)) :
            new Vector(data)).memoize();
    }
    _loadVectors(header, body, types) {
        return new VectorLoader(body, header.nodes, header.buffers, this.dictionaries, this.schema.metadataVersion).visitMany(types);
    }
}
/** @ignore */
class RecordBatchStreamReaderImpl extends RecordBatchReaderImpl {
    constructor(source, dictionaries) {
        super(dictionaries);
        this._reader = !isArrowJSON(source)
            ? new MessageReader(this._handle = source)
            : new JSONMessageReader(this._handle = source);
    }
    isSync() { return true; }
    isStream() { return true; }
    [Symbol.iterator]() {
        return this;
    }
    cancel() {
        if (!this.closed && (this.closed = true)) {
            this.reset()._reader.return();
            this._reader = null;
            this.dictionaries = null;
        }
    }
    open(options) {
        if (!this.closed) {
            this.autoDestroy = shouldAutoDestroy(this, options);
            if (!(this.schema || (this.schema = this._reader.readSchema()))) {
                this.cancel();
            }
        }
        return this;
    }
    throw(value) {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return this.reset()._reader.throw(value);
        }
        return ITERATOR_DONE;
    }
    return(value) {
        if (!this.closed && this.autoDestroy && (this.closed = true)) {
            return this.reset()._reader.return(value);
        }
        return ITERATOR_DONE;
    }
    next() {
        if (this.closed) {
            return ITERATOR_DONE;
        }
        let message;
        const { _reader: reader } = this;
        while (message = this._readNextMessageAndValidate()) {
            if (message.isSchema()) {
                this.reset(message.header());
            }
            else if (message.isRecordBatch()) {
                this._recordBatchIndex++;
                const header = message.header();
                const buffer = reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return { done: false, value: recordBatch };
            }
            else if (message.isDictionaryBatch()) {
                this._dictionaryIndex++;
                const header = message.header();
                const buffer = reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
        if (this.schema && this._recordBatchIndex === 0) {
            this._recordBatchIndex++;
            return { done: false, value: new _InternalEmptyPlaceholderRecordBatch(this.schema) };
        }
        return this.return();
    }
    _readNextMessageAndValidate(type) {
        return this._reader.readMessage(type);
    }
}
/** @ignore */
class AsyncRecordBatchStreamReaderImpl extends RecordBatchReaderImpl {
    constructor(source, dictionaries) {
        super(dictionaries);
        this._reader = new AsyncMessageReader(this._handle = source);
    }
    isAsync() { return true; }
    isStream() { return true; }
    [Symbol.asyncIterator]() {
        return this;
    }
    cancel() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.closed && (this.closed = true)) {
                yield this.reset()._reader.return();
                this._reader = null;
                this.dictionaries = null;
            }
        });
    }
    open(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.closed) {
                this.autoDestroy = shouldAutoDestroy(this, options);
                if (!(this.schema || (this.schema = (yield this._reader.readSchema())))) {
                    yield this.cancel();
                }
            }
            return this;
        });
    }
    throw(value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.closed && this.autoDestroy && (this.closed = true)) {
                return yield this.reset()._reader.throw(value);
            }
            return ITERATOR_DONE;
        });
    }
    return(value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.closed && this.autoDestroy && (this.closed = true)) {
                return yield this.reset()._reader.return(value);
            }
            return ITERATOR_DONE;
        });
    }
    next() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.closed) {
                return ITERATOR_DONE;
            }
            let message;
            const { _reader: reader } = this;
            while (message = yield this._readNextMessageAndValidate()) {
                if (message.isSchema()) {
                    yield this.reset(message.header());
                }
                else if (message.isRecordBatch()) {
                    this._recordBatchIndex++;
                    const header = message.header();
                    const buffer = yield reader.readMessageBody(message.bodyLength);
                    const recordBatch = this._loadRecordBatch(header, buffer);
                    return { done: false, value: recordBatch };
                }
                else if (message.isDictionaryBatch()) {
                    this._dictionaryIndex++;
                    const header = message.header();
                    const buffer = yield reader.readMessageBody(message.bodyLength);
                    const vector = this._loadDictionaryBatch(header, buffer);
                    this.dictionaries.set(header.id, vector);
                }
            }
            if (this.schema && this._recordBatchIndex === 0) {
                this._recordBatchIndex++;
                return { done: false, value: new _InternalEmptyPlaceholderRecordBatch(this.schema) };
            }
            return yield this.return();
        });
    }
    _readNextMessageAndValidate(type) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._reader.readMessage(type);
        });
    }
}
/** @ignore */
class RecordBatchFileReaderImpl extends RecordBatchStreamReaderImpl {
    get footer() { return this._footer; }
    get numDictionaries() { return this._footer ? this._footer.numDictionaries : 0; }
    get numRecordBatches() { return this._footer ? this._footer.numRecordBatches : 0; }
    constructor(source, dictionaries) {
        super(source instanceof RandomAccessFile ? source : new RandomAccessFile(source), dictionaries);
    }
    isSync() { return true; }
    isFile() { return true; }
    open(options) {
        if (!this.closed && !this._footer) {
            this.schema = (this._footer = this._readFooter()).schema;
            for (const block of this._footer.dictionaryBatches()) {
                block && this._readDictionaryBatch(this._dictionaryIndex++);
            }
        }
        return super.open(options);
    }
    readRecordBatch(index) {
        var _a;
        if (this.closed) {
            return null;
        }
        if (!this._footer) {
            this.open();
        }
        const block = (_a = this._footer) === null || _a === void 0 ? void 0 : _a.getRecordBatch(index);
        if (block && this._handle.seek(block.offset)) {
            const message = this._reader.readMessage(MessageHeader.RecordBatch);
            if (message === null || message === void 0 ? void 0 : message.isRecordBatch()) {
                const header = message.header();
                const buffer = this._reader.readMessageBody(message.bodyLength);
                const recordBatch = this._loadRecordBatch(header, buffer);
                return recordBatch;
            }
        }
        return null;
    }
    _readDictionaryBatch(index) {
        var _a;
        const block = (_a = this._footer) === null || _a === void 0 ? void 0 : _a.getDictionaryBatch(index);
        if (block && this._handle.seek(block.offset)) {
            const message = this._reader.readMessage(MessageHeader.DictionaryBatch);
            if (message === null || message === void 0 ? void 0 : message.isDictionaryBatch()) {
                const header = message.header();
                const buffer = this._reader.readMessageBody(message.bodyLength);
                const vector = this._loadDictionaryBatch(header, buffer);
                this.dictionaries.set(header.id, vector);
            }
        }
    }
    _readFooter() {
        const { _handle } = this;
        const offset = _handle.size - magicAndPadding;
        const length = _handle.readInt32(offset);
        const buffer = _handle.readAt(offset - length, length);
        return Footer.decode(buffer);
    }
    _readNextMessageAndValidate(type) {
        var _a;
        if (!this._footer) {
            this.open();
        }
        if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
            const block = (_a = this._footer) === null || _a === void 0 ? void 0 : _a.getRecordBatch(this._recordBatchIndex);
            if (block && this._handle.seek(block.offset)) {
                return this._reader.readMessage(type);
            }
        }
        return null;
    }
}
/** @ignore */
class AsyncRecordBatchFileReaderImpl extends AsyncRecordBatchStreamReaderImpl {
    get footer() { return this._footer; }
    get numDictionaries() { return this._footer ? this._footer.numDictionaries : 0; }
    get numRecordBatches() { return this._footer ? this._footer.numRecordBatches : 0; }
    constructor(source, ...rest) {
        const byteLength = typeof rest[0] !== 'number' ? rest.shift() : undefined;
        const dictionaries = rest[0] instanceof Map ? rest.shift() : undefined;
        super(source instanceof AsyncRandomAccessFile ? source : new AsyncRandomAccessFile(source, byteLength), dictionaries);
    }
    isFile() { return true; }
    isAsync() { return true; }
    open(options) {
        const _super = Object.create(null, {
            open: { get: () => super.open }
        });
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.closed && !this._footer) {
                this.schema = (this._footer = yield this._readFooter()).schema;
                for (const block of this._footer.dictionaryBatches()) {
                    block && (yield this._readDictionaryBatch(this._dictionaryIndex++));
                }
            }
            return yield _super.open.call(this, options);
        });
    }
    readRecordBatch(index) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.closed) {
                return null;
            }
            if (!this._footer) {
                yield this.open();
            }
            const block = (_a = this._footer) === null || _a === void 0 ? void 0 : _a.getRecordBatch(index);
            if (block && (yield this._handle.seek(block.offset))) {
                const message = yield this._reader.readMessage(MessageHeader.RecordBatch);
                if (message === null || message === void 0 ? void 0 : message.isRecordBatch()) {
                    const header = message.header();
                    const buffer = yield this._reader.readMessageBody(message.bodyLength);
                    const recordBatch = this._loadRecordBatch(header, buffer);
                    return recordBatch;
                }
            }
            return null;
        });
    }
    _readDictionaryBatch(index) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const block = (_a = this._footer) === null || _a === void 0 ? void 0 : _a.getDictionaryBatch(index);
            if (block && (yield this._handle.seek(block.offset))) {
                const message = yield this._reader.readMessage(MessageHeader.DictionaryBatch);
                if (message === null || message === void 0 ? void 0 : message.isDictionaryBatch()) {
                    const header = message.header();
                    const buffer = yield this._reader.readMessageBody(message.bodyLength);
                    const vector = this._loadDictionaryBatch(header, buffer);
                    this.dictionaries.set(header.id, vector);
                }
            }
        });
    }
    _readFooter() {
        return __awaiter(this, void 0, void 0, function* () {
            const { _handle } = this;
            _handle._pending && (yield _handle._pending);
            const offset = _handle.size - magicAndPadding;
            const length = yield _handle.readInt32(offset);
            const buffer = yield _handle.readAt(offset - length, length);
            return Footer.decode(buffer);
        });
    }
    _readNextMessageAndValidate(type) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._footer) {
                yield this.open();
            }
            if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
                const block = this._footer.getRecordBatch(this._recordBatchIndex);
                if (block && (yield this._handle.seek(block.offset))) {
                    return yield this._reader.readMessage(type);
                }
            }
            return null;
        });
    }
}
/** @ignore */
class RecordBatchJSONReaderImpl extends RecordBatchStreamReaderImpl {
    constructor(source, dictionaries) {
        super(source, dictionaries);
    }
    _loadVectors(header, body, types) {
        return new JSONVectorLoader(body, header.nodes, header.buffers, this.dictionaries, this.schema.metadataVersion).visitMany(types);
    }
}
//
// Define some helper functions and static implementations down here. There's
// a bit of branching in the static methods that can lead to the same routines
// being executed, so we've broken those out here for readability.
//
/** @ignore */
function shouldAutoDestroy(self, options) {
    return options && (typeof options['autoDestroy'] === 'boolean') ? options['autoDestroy'] : self['autoDestroy'];
}
/** @ignore */
function* readAllSync(source) {
    const reader = RecordBatchReader.from(source);
    try {
        if (!reader.open({ autoDestroy: false }).closed) {
            do {
                yield reader;
            } while (!(reader.reset().open()).closed);
        }
    }
    finally {
        reader.cancel();
    }
}
/** @ignore */
function readAllAsync(source) {
    return __asyncGenerator(this, arguments, function* readAllAsync_1() {
        const reader = yield __await(RecordBatchReader.from(source));
        try {
            if (!(yield __await(reader.open({ autoDestroy: false }))).closed) {
                do {
                    yield yield __await(reader);
                } while (!(yield __await(reader.reset().open())).closed);
            }
        }
        finally {
            yield __await(reader.cancel());
        }
    });
}
/** @ignore */
function fromArrowJSON(source) {
    return new RecordBatchStreamReader(new RecordBatchJSONReaderImpl(source));
}
/** @ignore */
function fromByteStream(source) {
    const bytes = source.peek((magicLength + 7) & ~7);
    return bytes && bytes.byteLength >= 4 ? !checkForMagicArrowString(bytes)
        ? new RecordBatchStreamReader(new RecordBatchStreamReaderImpl(source))
        : new RecordBatchFileReader(new RecordBatchFileReaderImpl(source.read()))
        : new RecordBatchStreamReader(new RecordBatchStreamReaderImpl(function* () { }()));
}
/** @ignore */
function fromAsyncByteStream(source) {
    return __awaiter(this, void 0, void 0, function* () {
        const bytes = yield source.peek((magicLength + 7) & ~7);
        return bytes && bytes.byteLength >= 4 ? !checkForMagicArrowString(bytes)
            ? new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl(source))
            : new RecordBatchFileReader(new RecordBatchFileReaderImpl(yield source.read()))
            : new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl(function () { return __asyncGenerator(this, arguments, function* () { }); }()));
    });
}
/** @ignore */
function fromFileHandle(source) {
    return __awaiter(this, void 0, void 0, function* () {
        const { size } = yield source.stat();
        const file = new AsyncRandomAccessFile(source, size);
        if (size >= magicX2AndPadding && checkForMagicArrowString(yield file.readAt(0, (magicLength + 7) & ~7))) {
            return new AsyncRecordBatchFileReader(new AsyncRecordBatchFileReaderImpl(file));
        }
        return new AsyncRecordBatchStreamReader(new AsyncRecordBatchStreamReaderImpl(file));
    });
}

//# sourceMappingURL=reader.mjs.map
