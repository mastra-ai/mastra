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

/* eslint-disable brace-style */

import * as flatbuffers from 'flatbuffers';

import { Schema as _Schema } from '../../fb/schema.js';
import { Int as _Int } from '../../fb/int.js';
import { RecordBatch as _RecordBatch } from '../../fb/record-batch.js';
import { DictionaryBatch as _DictionaryBatch } from '../../fb/dictionary-batch.js';
import { Buffer as _Buffer } from '../../fb/buffer.js';
import { Field as _Field } from '../../fb/field.js';
import { FieldNode as _FieldNode } from '../../fb/field-node.js';
import { DictionaryEncoding as _DictionaryEncoding } from '../../fb/dictionary-encoding.js';
import { Type } from '../../fb/type.js';
import { KeyValue as _KeyValue } from '../../fb/key-value.js';
import { Endianness as _Endianness } from '../../fb/endianness.js';
import { FloatingPoint as _FloatingPoint } from '../../fb/floating-point.js';
import { Decimal as _Decimal } from '../../fb/decimal.js';
import { Date as _Date } from '../../fb/date.js';
import { Time as _Time } from '../../fb/time.js';
import { Timestamp as _Timestamp } from '../../fb/timestamp.js';
import { Interval as _Interval } from '../../fb/interval.js';
import { Duration as _Duration } from '../../fb/duration.js';
import { Union as _Union } from '../../fb/union.js';
import { FixedSizeBinary as _FixedSizeBinary } from '../../fb/fixed-size-binary.js';
import { FixedSizeList as _FixedSizeList } from '../../fb/fixed-size-list.js';
import { Map as _Map } from '../../fb/map.js';
import { Message as _Message } from '../../fb/message.js';

import { Schema, Field } from '../../schema.js';
import { toUint8Array } from '../../util/buffer.js';
import { ArrayBufferViewInput } from '../../util/buffer.js';
import { bigIntToNumber } from '../../util/bigint.js';
import { MessageHeader, MetadataVersion } from '../../enum.js';
import { instance as typeAssembler } from '../../visitor/typeassembler.js';
import { fieldFromJSON, schemaFromJSON, recordBatchFromJSON, dictionaryBatchFromJSON } from './json.js';

import Builder = flatbuffers.Builder;
import ByteBuffer = flatbuffers.ByteBuffer;

import {
    DataType, Dictionary, TimeBitWidth,
    Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary,
    List, FixedSizeList, Map_, Struct, Union,
    Bool, Null, Int, Float, Date_, Time, Interval, Timestamp, IntBitWidth, Int32, TKeys, Duration,
} from '../../type.js';

/**
 * @ignore
 * @private
 **/
export class Message<T extends MessageHeader = any> {

    /** @nocollapse */
    public static fromJSON<T extends MessageHeader>(msg: any, headerType: T): Message<T> {
        const message = new Message(0, MetadataVersion.V5, headerType);
        message._createHeader = messageHeaderFromJSON(msg, headerType);
        return message;
    }

    /** @nocollapse */
    public static decode(buf: ArrayBufferViewInput) {
        buf = new ByteBuffer(toUint8Array(buf));
        const _message = _Message.getRootAsMessage(buf);
        const bodyLength: bigint = _message.bodyLength()!;
        const version: MetadataVersion = _message.version();
        const headerType: MessageHeader = _message.headerType();
        const message = new Message(bodyLength, version, headerType);
        message._createHeader = decodeMessageHeader(_message, headerType);
        return message;
    }

    /** @nocollapse */
    public static encode<T extends MessageHeader>(message: Message<T>) {
        const b = new Builder();
        let headerOffset = -1;
        if (message.isSchema()) {
            headerOffset = Schema.encode(b, message.header() as Schema);
        } else if (message.isRecordBatch()) {
            headerOffset = RecordBatch.encode(b, message.header() as RecordBatch);
        } else if (message.isDictionaryBatch()) {
            headerOffset = DictionaryBatch.encode(b, message.header() as DictionaryBatch);
        }
        _Message.startMessage(b);
        _Message.addVersion(b, MetadataVersion.V5);
        _Message.addHeader(b, headerOffset);
        _Message.addHeaderType(b, message.headerType);
        _Message.addBodyLength(b, BigInt(message.bodyLength));
        _Message.finishMessageBuffer(b, _Message.endMessage(b));
        return b.asUint8Array();
    }

    /** @nocollapse */
    public static from(header: Schema | RecordBatch | DictionaryBatch, bodyLength = 0) {
        if (header instanceof Schema) {
            return new Message(0, MetadataVersion.V5, MessageHeader.Schema, header);
        }
        if (header instanceof RecordBatch) {
            return new Message(bodyLength, MetadataVersion.V5, MessageHeader.RecordBatch, header);
        }
        if (header instanceof DictionaryBatch) {
            return new Message(bodyLength, MetadataVersion.V5, MessageHeader.DictionaryBatch, header);
        }
        throw new Error(`Unrecognized Message header: ${header}`);
    }

    public body: Uint8Array;
    protected _headerType: T;
    protected _bodyLength: number;
    protected _version: MetadataVersion;
    public get type() { return this.headerType; }
    public get version() { return this._version; }
    public get headerType() { return this._headerType; }
    public get bodyLength() { return this._bodyLength; }
    declare protected _createHeader: MessageHeaderDecoder;
    public header() { return this._createHeader<T>(); }
    public isSchema(): this is Message<MessageHeader.Schema> { return this.headerType === MessageHeader.Schema; }
    public isRecordBatch(): this is Message<MessageHeader.RecordBatch> { return this.headerType === MessageHeader.RecordBatch; }
    public isDictionaryBatch(): this is Message<MessageHeader.DictionaryBatch> { return this.headerType === MessageHeader.DictionaryBatch; }

    constructor(bodyLength: bigint | number, version: MetadataVersion, headerType: T, header?: any) {
        this._version = version;
        this._headerType = headerType;
        this.body = new Uint8Array(0);
        header && (this._createHeader = () => header);
        this._bodyLength = bigIntToNumber(bodyLength);
    }
}

/**
 * @ignore
 * @private
 **/
export class RecordBatch {
    protected _length: number;
    protected _nodes: FieldNode[];
    protected _buffers: BufferRegion[];
    public get nodes() { return this._nodes; }
    public get length() { return this._length; }
    public get buffers() { return this._buffers; }
    constructor(length: bigint | number, nodes: FieldNode[], buffers: BufferRegion[]) {
        this._nodes = nodes;
        this._buffers = buffers;
        this._length = bigIntToNumber(length);
    }
}

/**
 * @ignore
 * @private
 **/
export class DictionaryBatch {

    protected _id: number;
    protected _isDelta: boolean;
    protected _data: RecordBatch;
    public get id() { return this._id; }
    public get data() { return this._data; }
    public get isDelta() { return this._isDelta; }
    public get length(): number { return this.data.length; }
    public get nodes(): FieldNode[] { return this.data.nodes; }
    public get buffers(): BufferRegion[] { return this.data.buffers; }

    constructor(data: RecordBatch, id: bigint | number, isDelta = false) {
        this._data = data;
        this._isDelta = isDelta;
        this._id = bigIntToNumber(id);
    }
}

/**
 * @ignore
 * @private
 **/
export class BufferRegion {
    public offset: number;
    public length: number;
    constructor(offset: bigint | number, length: bigint | number) {
        this.offset = bigIntToNumber(offset);
        this.length = bigIntToNumber(length);
    }
}

/**
 * @ignore
 * @private
 **/
export class FieldNode {
    public length: number;
    public nullCount: number;
    constructor(length: bigint | number, nullCount: bigint | number) {
        this.length = bigIntToNumber(length);
        this.nullCount = bigIntToNumber(nullCount);
    }
}

/** @ignore */
function messageHeaderFromJSON(message: any, type: MessageHeader) {
    return (() => {
        switch (type) {
            case MessageHeader.Schema: return Schema.fromJSON(message);
            case MessageHeader.RecordBatch: return RecordBatch.fromJSON(message);
            case MessageHeader.DictionaryBatch: return DictionaryBatch.fromJSON(message);
        }
        throw new Error(`Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`);
    }) as MessageHeaderDecoder;
}

/** @ignore */
function decodeMessageHeader(message: _Message, type: MessageHeader) {
    return (() => {
        switch (type) {
            case MessageHeader.Schema: return Schema.decode(message.header(new _Schema())!, new Map(), message.version());
            case MessageHeader.RecordBatch: return RecordBatch.decode(message.header(new _RecordBatch())!, message.version());
            case MessageHeader.DictionaryBatch: return DictionaryBatch.decode(message.header(new _DictionaryBatch())!, message.version());
        }
        throw new Error(`Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`);
    }) as MessageHeaderDecoder;
}

Field['encode'] = encodeField;
Field['decode'] = decodeField;
Field['fromJSON'] = fieldFromJSON;

Schema['encode'] = encodeSchema;
Schema['decode'] = decodeSchema;
Schema['fromJSON'] = schemaFromJSON;

RecordBatch['encode'] = encodeRecordBatch;
RecordBatch['decode'] = decodeRecordBatch;
RecordBatch['fromJSON'] = recordBatchFromJSON;

DictionaryBatch['encode'] = encodeDictionaryBatch;
DictionaryBatch['decode'] = decodeDictionaryBatch;
DictionaryBatch['fromJSON'] = dictionaryBatchFromJSON;

FieldNode['encode'] = encodeFieldNode;
FieldNode['decode'] = decodeFieldNode;

BufferRegion['encode'] = encodeBufferRegion;
BufferRegion['decode'] = decodeBufferRegion;

declare module '../../schema' {
    namespace Field {
        export { encodeField as encode };
        export { decodeField as decode };
        export { fieldFromJSON as fromJSON };
    }
    namespace Schema {
        export { encodeSchema as encode };
        export { decodeSchema as decode };
        export { schemaFromJSON as fromJSON };
    }
}

declare module './message' {
    namespace RecordBatch {
        export { encodeRecordBatch as encode };
        export { decodeRecordBatch as decode };
        export { recordBatchFromJSON as fromJSON };
    }
    namespace DictionaryBatch {
        export { encodeDictionaryBatch as encode };
        export { decodeDictionaryBatch as decode };
        export { dictionaryBatchFromJSON as fromJSON };
    }
    namespace FieldNode {
        export { encodeFieldNode as encode };
        export { decodeFieldNode as decode };
    }
    namespace BufferRegion {
        export { encodeBufferRegion as encode };
        export { decodeBufferRegion as decode };
    }
}

/** @ignore */
function decodeSchema(_schema: _Schema, dictionaries: Map<number, DataType> = new Map(), version = MetadataVersion.V5) {
    const fields = decodeSchemaFields(_schema, dictionaries);
    return new Schema(fields, decodeCustomMetadata(_schema), dictionaries, version);
}

/** @ignore */
function decodeRecordBatch(batch: _RecordBatch, version = MetadataVersion.V5) {
    if (batch.compression() !== null) {
        throw new Error('Record batch compression not implemented');
    }
    return new RecordBatch(batch.length(), decodeFieldNodes(batch), decodeBuffers(batch, version));
}

/** @ignore */
function decodeDictionaryBatch(batch: _DictionaryBatch, version = MetadataVersion.V5) {
    return new DictionaryBatch(RecordBatch.decode(batch.data()!, version), batch.id(), batch.isDelta());
}

/** @ignore */
function decodeBufferRegion(b: _Buffer) {
    return new BufferRegion(b.offset(), b.length());
}

/** @ignore */
function decodeFieldNode(f: _FieldNode) {
    return new FieldNode(f.length(), f.nullCount());
}

/** @ignore */
function decodeFieldNodes(batch: _RecordBatch) {
    const nodes = [] as FieldNode[];
    for (let f, i = -1, j = -1, n = batch.nodesLength(); ++i < n;) {
        if (f = batch.nodes(i)) {
            nodes[++j] = FieldNode.decode(f);
        }
    }
    return nodes;
}

/** @ignore */
function decodeBuffers(batch: _RecordBatch, version: MetadataVersion) {
    const bufferRegions = [] as BufferRegion[];
    for (let b, i = -1, j = -1, n = batch.buffersLength(); ++i < n;) {
        if (b = batch.buffers(i)) {
            // If this Arrow buffer was written before version 4,
            // advance the buffer's bb_pos 8 bytes to skip past
            // the now-removed page_id field
            if (version < MetadataVersion.V4) {
                b.bb_pos += (8 * (i + 1));
            }
            bufferRegions[++j] = BufferRegion.decode(b);
        }
    }
    return bufferRegions;
}

/** @ignore */
function decodeSchemaFields(schema: _Schema, dictionaries?: Map<number, DataType>) {
    const fields = [] as Field[];
    for (let f, i = -1, j = -1, n = schema.fieldsLength(); ++i < n;) {
        if (f = schema.fields(i)) {
            fields[++j] = Field.decode(f, dictionaries);
        }
    }
    return fields;
}

/** @ignore */
function decodeFieldChildren(field: _Field, dictionaries?: Map<number, DataType>): Field[] {
    const children = [] as Field[];
    for (let f, i = -1, j = -1, n = field.childrenLength(); ++i < n;) {
        if (f = field.children(i)) {
            children[++j] = Field.decode(f, dictionaries);
        }
    }
    return children;
}

/** @ignore */
function decodeField(f: _Field, dictionaries?: Map<number, DataType>) {

    let id: number;
    let field: Field | void;
    let type: DataType<any>;
    let keys: _Int | TKeys | null;
    let dictType: Dictionary;
    let dictMeta: _DictionaryEncoding | null;

    // If no dictionary encoding
    if (!dictionaries || !(dictMeta = f.dictionary())) {
        type = decodeFieldType(f, decodeFieldChildren(f, dictionaries));
        field = new Field(f.name()!, type, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded and the first time we've seen this dictionary id, decode
    // the data type and child fields, then wrap in a Dictionary type and insert the
    // data type into the dictionary types map.
    else if (!dictionaries.has(id = bigIntToNumber(dictMeta.id()))) {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) as TKeys : new Int32();
        dictionaries.set(id, type = decodeFieldType(f, decodeFieldChildren(f, dictionaries)));
        dictType = new Dictionary(type, keys, id, dictMeta.isOrdered());
        field = new Field(f.name()!, dictType, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
    // data type and wrap in a new Dictionary type and field.
    else {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) as TKeys : new Int32();
        dictType = new Dictionary(dictionaries.get(id)!, keys, id, dictMeta.isOrdered());
        field = new Field(f.name()!, dictType, f.nullable(), decodeCustomMetadata(f));
    }
    return field || null;
}

/** @ignore */
function decodeCustomMetadata(parent?: _Schema | _Field | null) {
    const data = new Map<string, string>();
    if (parent) {
        for (let entry, key, i = -1, n = Math.trunc(parent.customMetadataLength()); ++i < n;) {
            if ((entry = parent.customMetadata(i)) && (key = entry.key()) != null) {
                data.set(key, entry.value()!);
            }
        }
    }
    return data;
}

/** @ignore */
function decodeIndexType(_type: _Int) {
    return new Int(_type.isSigned(), _type.bitWidth() as IntBitWidth);
}

/** @ignore */
function decodeFieldType(f: _Field, children?: Field[]): DataType<any> {

    const typeId = f.typeType();

    switch (typeId) {
        case Type['NONE']: return new Null();
        case Type['Null']: return new Null();
        case Type['Binary']: return new Binary();
        case Type['LargeBinary']: return new LargeBinary();
        case Type['Utf8']: return new Utf8();
        case Type['LargeUtf8']: return new LargeUtf8();
        case Type['Bool']: return new Bool();
        case Type['List']: return new List((children || [])[0]);
        case Type['Struct_']: return new Struct(children || []);
    }

    switch (typeId) {
        case Type['Int']: {
            const t = f.type(new _Int())!;
            return new Int(t.isSigned(), t.bitWidth());
        }
        case Type['FloatingPoint']: {
            const t = f.type(new _FloatingPoint())!;
            return new Float(t.precision());
        }
        case Type['Decimal']: {
            const t = f.type(new _Decimal())!;
            return new Decimal(t.scale(), t.precision(), t.bitWidth());
        }
        case Type['Date']: {
            const t = f.type(new _Date())!;
            return new Date_(t.unit());
        }
        case Type['Time']: {
            const t = f.type(new _Time())!;
            return new Time(t.unit(), t.bitWidth() as TimeBitWidth);
        }
        case Type['Timestamp']: {
            const t = f.type(new _Timestamp())!;
            return new Timestamp(t.unit(), t.timezone());
        }
        case Type['Interval']: {
            const t = f.type(new _Interval())!;
            return new Interval(t.unit());
        }
        case Type['Duration']: {
            const t = f.type(new _Duration())!;
            return new Duration(t.unit());
        }
        case Type['Union']: {
            const t = f.type(new _Union())!;
            return new Union(t.mode(), t.typeIdsArray() || [], children || []);
        }
        case Type['FixedSizeBinary']: {
            const t = f.type(new _FixedSizeBinary())!;
            return new FixedSizeBinary(t.byteWidth());
        }
        case Type['FixedSizeList']: {
            const t = f.type(new _FixedSizeList())!;
            return new FixedSizeList(t.listSize(), (children || [])[0]);
        }
        case Type['Map']: {
            const t = f.type(new _Map())!;
            return new Map_((children || [])[0], t.keysSorted());
        }
    }
    throw new Error(`Unrecognized type: "${Type[typeId]}" (${typeId})`);
}

/** @ignore */
function encodeSchema(b: Builder, schema: Schema) {

    const fieldOffsets = schema.fields.map((f) => Field.encode(b, f));

    _Schema.startFieldsVector(b, fieldOffsets.length);

    const fieldsVectorOffset = _Schema.createFieldsVector(b, fieldOffsets);

    const metadataOffset = !(schema.metadata && schema.metadata.size > 0) ? -1 :
        _Schema.createCustomMetadataVector(b, [...schema.metadata].map(([k, v]) => {
            const key = b.createString(`${k}`);
            const val = b.createString(`${v}`);
            _KeyValue.startKeyValue(b);
            _KeyValue.addKey(b, key);
            _KeyValue.addValue(b, val);
            return _KeyValue.endKeyValue(b);
        }));

    _Schema.startSchema(b);
    _Schema.addFields(b, fieldsVectorOffset);
    _Schema.addEndianness(b, platformIsLittleEndian ? _Endianness.Little : _Endianness.Big);

    if (metadataOffset !== -1) { _Schema.addCustomMetadata(b, metadataOffset); }

    return _Schema.endSchema(b);
}

/** @ignore */
function encodeField(b: Builder, field: Field) {

    let nameOffset = -1;
    let typeOffset = -1;
    let dictionaryOffset = -1;

    const type = field.type;
    let typeId: Type = <any>field.typeId;

    if (!DataType.isDictionary(type)) {
        typeOffset = typeAssembler.visit(type, b)!;
    } else {
        typeId = type.dictionary.typeId;
        dictionaryOffset = typeAssembler.visit(type, b)!;
        typeOffset = typeAssembler.visit(type.dictionary, b)!;
    }

    const childOffsets = (type.children || []).map((f: Field) => Field.encode(b, f));
    const childrenVectorOffset = _Field.createChildrenVector(b, childOffsets);

    const metadataOffset = !(field.metadata && field.metadata.size > 0) ? -1 :
        _Field.createCustomMetadataVector(b, [...field.metadata].map(([k, v]) => {
            const key = b.createString(`${k}`);
            const val = b.createString(`${v}`);
            _KeyValue.startKeyValue(b);
            _KeyValue.addKey(b, key);
            _KeyValue.addValue(b, val);
            return _KeyValue.endKeyValue(b);
        }));

    if (field.name) {
        nameOffset = b.createString(field.name);
    }

    _Field.startField(b);
    _Field.addType(b, typeOffset);
    _Field.addTypeType(b, typeId);
    _Field.addChildren(b, childrenVectorOffset);
    _Field.addNullable(b, !!field.nullable);

    if (nameOffset !== -1) { _Field.addName(b, nameOffset); }
    if (dictionaryOffset !== -1) { _Field.addDictionary(b, dictionaryOffset); }
    if (metadataOffset !== -1) { _Field.addCustomMetadata(b, metadataOffset); }

    return _Field.endField(b);
}

/** @ignore */
function encodeRecordBatch(b: Builder, recordBatch: RecordBatch) {

    const nodes = recordBatch.nodes || [];
    const buffers = recordBatch.buffers || [];

    _RecordBatch.startNodesVector(b, nodes.length);
    for (const n of nodes.slice().reverse()) FieldNode.encode(b, n);

    const nodesVectorOffset = b.endVector();

    _RecordBatch.startBuffersVector(b, buffers.length);
    for (const b_ of buffers.slice().reverse()) BufferRegion.encode(b, b_);

    const buffersVectorOffset = b.endVector();

    _RecordBatch.startRecordBatch(b);
    _RecordBatch.addLength(b, BigInt(recordBatch.length));
    _RecordBatch.addNodes(b, nodesVectorOffset);
    _RecordBatch.addBuffers(b, buffersVectorOffset);
    return _RecordBatch.endRecordBatch(b);
}

/** @ignore */
function encodeDictionaryBatch(b: Builder, dictionaryBatch: DictionaryBatch) {
    const dataOffset = RecordBatch.encode(b, dictionaryBatch.data);
    _DictionaryBatch.startDictionaryBatch(b);
    _DictionaryBatch.addId(b, BigInt(dictionaryBatch.id));
    _DictionaryBatch.addIsDelta(b, dictionaryBatch.isDelta);
    _DictionaryBatch.addData(b, dataOffset);
    return _DictionaryBatch.endDictionaryBatch(b);
}

/** @ignore */
function encodeFieldNode(b: Builder, node: FieldNode) {
    return _FieldNode.createFieldNode(b, BigInt(node.length), BigInt(node.nullCount));
}

/** @ignore */
function encodeBufferRegion(b: Builder, node: BufferRegion) {
    return _Buffer.createBuffer(b, BigInt(node.offset), BigInt(node.length));
}

/** @ignore */
const platformIsLittleEndian = (() => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
    // Int16Array uses the platform's endianness.
    return new Int16Array(buffer)[0] === 256;
})();

/** @ignore */
type MessageHeaderDecoder = <T extends MessageHeader>() => T extends MessageHeader.Schema ? Schema
    : T extends MessageHeader.RecordBatch ? RecordBatch
    : T extends MessageHeader.DictionaryBatch ? DictionaryBatch : never;
