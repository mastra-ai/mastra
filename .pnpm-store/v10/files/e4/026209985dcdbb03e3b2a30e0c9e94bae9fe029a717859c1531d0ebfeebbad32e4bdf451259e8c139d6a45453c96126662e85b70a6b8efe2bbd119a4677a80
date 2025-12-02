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
import { Schema as _Schema } from '../../fb/schema.mjs';
import { Int as _Int } from '../../fb/int.mjs';
import { RecordBatch as _RecordBatch } from '../../fb/record-batch.mjs';
import { DictionaryBatch as _DictionaryBatch } from '../../fb/dictionary-batch.mjs';
import { Buffer as _Buffer } from '../../fb/buffer.mjs';
import { Field as _Field } from '../../fb/field.mjs';
import { FieldNode as _FieldNode } from '../../fb/field-node.mjs';
import { Type } from '../../fb/type.mjs';
import { KeyValue as _KeyValue } from '../../fb/key-value.mjs';
import { Endianness as _Endianness } from '../../fb/endianness.mjs';
import { FloatingPoint as _FloatingPoint } from '../../fb/floating-point.mjs';
import { Decimal as _Decimal } from '../../fb/decimal.mjs';
import { Date as _Date } from '../../fb/date.mjs';
import { Time as _Time } from '../../fb/time.mjs';
import { Timestamp as _Timestamp } from '../../fb/timestamp.mjs';
import { Interval as _Interval } from '../../fb/interval.mjs';
import { Duration as _Duration } from '../../fb/duration.mjs';
import { Union as _Union } from '../../fb/union.mjs';
import { FixedSizeBinary as _FixedSizeBinary } from '../../fb/fixed-size-binary.mjs';
import { FixedSizeList as _FixedSizeList } from '../../fb/fixed-size-list.mjs';
import { Map as _Map } from '../../fb/map.mjs';
import { Message as _Message } from '../../fb/message.mjs';
import { Schema, Field } from '../../schema.mjs';
import { toUint8Array } from '../../util/buffer.mjs';
import { bigIntToNumber } from '../../util/bigint.mjs';
import { MessageHeader, MetadataVersion } from '../../enum.mjs';
import { instance as typeAssembler } from '../../visitor/typeassembler.mjs';
import { fieldFromJSON, schemaFromJSON, recordBatchFromJSON, dictionaryBatchFromJSON } from './json.mjs';
var Builder = flatbuffers.Builder;
var ByteBuffer = flatbuffers.ByteBuffer;
import { DataType, Dictionary, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Union, Bool, Null, Int, Float, Date_, Time, Interval, Timestamp, Int32, Duration, } from '../../type.mjs';
/**
 * @ignore
 * @private
 **/
export class Message {
    /** @nocollapse */
    static fromJSON(msg, headerType) {
        const message = new Message(0, MetadataVersion.V5, headerType);
        message._createHeader = messageHeaderFromJSON(msg, headerType);
        return message;
    }
    /** @nocollapse */
    static decode(buf) {
        buf = new ByteBuffer(toUint8Array(buf));
        const _message = _Message.getRootAsMessage(buf);
        const bodyLength = _message.bodyLength();
        const version = _message.version();
        const headerType = _message.headerType();
        const message = new Message(bodyLength, version, headerType);
        message._createHeader = decodeMessageHeader(_message, headerType);
        return message;
    }
    /** @nocollapse */
    static encode(message) {
        const b = new Builder();
        let headerOffset = -1;
        if (message.isSchema()) {
            headerOffset = Schema.encode(b, message.header());
        }
        else if (message.isRecordBatch()) {
            headerOffset = RecordBatch.encode(b, message.header());
        }
        else if (message.isDictionaryBatch()) {
            headerOffset = DictionaryBatch.encode(b, message.header());
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
    static from(header, bodyLength = 0) {
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
    get type() { return this.headerType; }
    get version() { return this._version; }
    get headerType() { return this._headerType; }
    get bodyLength() { return this._bodyLength; }
    header() { return this._createHeader(); }
    isSchema() { return this.headerType === MessageHeader.Schema; }
    isRecordBatch() { return this.headerType === MessageHeader.RecordBatch; }
    isDictionaryBatch() { return this.headerType === MessageHeader.DictionaryBatch; }
    constructor(bodyLength, version, headerType, header) {
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
    get nodes() { return this._nodes; }
    get length() { return this._length; }
    get buffers() { return this._buffers; }
    constructor(length, nodes, buffers) {
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
    get id() { return this._id; }
    get data() { return this._data; }
    get isDelta() { return this._isDelta; }
    get length() { return this.data.length; }
    get nodes() { return this.data.nodes; }
    get buffers() { return this.data.buffers; }
    constructor(data, id, isDelta = false) {
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
    constructor(offset, length) {
        this.offset = bigIntToNumber(offset);
        this.length = bigIntToNumber(length);
    }
}
/**
 * @ignore
 * @private
 **/
export class FieldNode {
    constructor(length, nullCount) {
        this.length = bigIntToNumber(length);
        this.nullCount = bigIntToNumber(nullCount);
    }
}
/** @ignore */
function messageHeaderFromJSON(message, type) {
    return (() => {
        switch (type) {
            case MessageHeader.Schema: return Schema.fromJSON(message);
            case MessageHeader.RecordBatch: return RecordBatch.fromJSON(message);
            case MessageHeader.DictionaryBatch: return DictionaryBatch.fromJSON(message);
        }
        throw new Error(`Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`);
    });
}
/** @ignore */
function decodeMessageHeader(message, type) {
    return (() => {
        switch (type) {
            case MessageHeader.Schema: return Schema.decode(message.header(new _Schema()), new Map(), message.version());
            case MessageHeader.RecordBatch: return RecordBatch.decode(message.header(new _RecordBatch()), message.version());
            case MessageHeader.DictionaryBatch: return DictionaryBatch.decode(message.header(new _DictionaryBatch()), message.version());
        }
        throw new Error(`Unrecognized Message type: { name: ${MessageHeader[type]}, type: ${type} }`);
    });
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
/** @ignore */
function decodeSchema(_schema, dictionaries = new Map(), version = MetadataVersion.V5) {
    const fields = decodeSchemaFields(_schema, dictionaries);
    return new Schema(fields, decodeCustomMetadata(_schema), dictionaries, version);
}
/** @ignore */
function decodeRecordBatch(batch, version = MetadataVersion.V5) {
    if (batch.compression() !== null) {
        throw new Error('Record batch compression not implemented');
    }
    return new RecordBatch(batch.length(), decodeFieldNodes(batch), decodeBuffers(batch, version));
}
/** @ignore */
function decodeDictionaryBatch(batch, version = MetadataVersion.V5) {
    return new DictionaryBatch(RecordBatch.decode(batch.data(), version), batch.id(), batch.isDelta());
}
/** @ignore */
function decodeBufferRegion(b) {
    return new BufferRegion(b.offset(), b.length());
}
/** @ignore */
function decodeFieldNode(f) {
    return new FieldNode(f.length(), f.nullCount());
}
/** @ignore */
function decodeFieldNodes(batch) {
    const nodes = [];
    for (let f, i = -1, j = -1, n = batch.nodesLength(); ++i < n;) {
        if (f = batch.nodes(i)) {
            nodes[++j] = FieldNode.decode(f);
        }
    }
    return nodes;
}
/** @ignore */
function decodeBuffers(batch, version) {
    const bufferRegions = [];
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
function decodeSchemaFields(schema, dictionaries) {
    const fields = [];
    for (let f, i = -1, j = -1, n = schema.fieldsLength(); ++i < n;) {
        if (f = schema.fields(i)) {
            fields[++j] = Field.decode(f, dictionaries);
        }
    }
    return fields;
}
/** @ignore */
function decodeFieldChildren(field, dictionaries) {
    const children = [];
    for (let f, i = -1, j = -1, n = field.childrenLength(); ++i < n;) {
        if (f = field.children(i)) {
            children[++j] = Field.decode(f, dictionaries);
        }
    }
    return children;
}
/** @ignore */
function decodeField(f, dictionaries) {
    let id;
    let field;
    let type;
    let keys;
    let dictType;
    let dictMeta;
    // If no dictionary encoding
    if (!dictionaries || !(dictMeta = f.dictionary())) {
        type = decodeFieldType(f, decodeFieldChildren(f, dictionaries));
        field = new Field(f.name(), type, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded and the first time we've seen this dictionary id, decode
    // the data type and child fields, then wrap in a Dictionary type and insert the
    // data type into the dictionary types map.
    else if (!dictionaries.has(id = bigIntToNumber(dictMeta.id()))) {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new Int32();
        dictionaries.set(id, type = decodeFieldType(f, decodeFieldChildren(f, dictionaries)));
        dictType = new Dictionary(type, keys, id, dictMeta.isOrdered());
        field = new Field(f.name(), dictType, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
    // data type and wrap in a new Dictionary type and field.
    else {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new Int32();
        dictType = new Dictionary(dictionaries.get(id), keys, id, dictMeta.isOrdered());
        field = new Field(f.name(), dictType, f.nullable(), decodeCustomMetadata(f));
    }
    return field || null;
}
/** @ignore */
function decodeCustomMetadata(parent) {
    const data = new Map();
    if (parent) {
        for (let entry, key, i = -1, n = Math.trunc(parent.customMetadataLength()); ++i < n;) {
            if ((entry = parent.customMetadata(i)) && (key = entry.key()) != null) {
                data.set(key, entry.value());
            }
        }
    }
    return data;
}
/** @ignore */
function decodeIndexType(_type) {
    return new Int(_type.isSigned(), _type.bitWidth());
}
/** @ignore */
function decodeFieldType(f, children) {
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
            const t = f.type(new _Int());
            return new Int(t.isSigned(), t.bitWidth());
        }
        case Type['FloatingPoint']: {
            const t = f.type(new _FloatingPoint());
            return new Float(t.precision());
        }
        case Type['Decimal']: {
            const t = f.type(new _Decimal());
            return new Decimal(t.scale(), t.precision(), t.bitWidth());
        }
        case Type['Date']: {
            const t = f.type(new _Date());
            return new Date_(t.unit());
        }
        case Type['Time']: {
            const t = f.type(new _Time());
            return new Time(t.unit(), t.bitWidth());
        }
        case Type['Timestamp']: {
            const t = f.type(new _Timestamp());
            return new Timestamp(t.unit(), t.timezone());
        }
        case Type['Interval']: {
            const t = f.type(new _Interval());
            return new Interval(t.unit());
        }
        case Type['Duration']: {
            const t = f.type(new _Duration());
            return new Duration(t.unit());
        }
        case Type['Union']: {
            const t = f.type(new _Union());
            return new Union(t.mode(), t.typeIdsArray() || [], children || []);
        }
        case Type['FixedSizeBinary']: {
            const t = f.type(new _FixedSizeBinary());
            return new FixedSizeBinary(t.byteWidth());
        }
        case Type['FixedSizeList']: {
            const t = f.type(new _FixedSizeList());
            return new FixedSizeList(t.listSize(), (children || [])[0]);
        }
        case Type['Map']: {
            const t = f.type(new _Map());
            return new Map_((children || [])[0], t.keysSorted());
        }
    }
    throw new Error(`Unrecognized type: "${Type[typeId]}" (${typeId})`);
}
/** @ignore */
function encodeSchema(b, schema) {
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
    if (metadataOffset !== -1) {
        _Schema.addCustomMetadata(b, metadataOffset);
    }
    return _Schema.endSchema(b);
}
/** @ignore */
function encodeField(b, field) {
    let nameOffset = -1;
    let typeOffset = -1;
    let dictionaryOffset = -1;
    const type = field.type;
    let typeId = field.typeId;
    if (!DataType.isDictionary(type)) {
        typeOffset = typeAssembler.visit(type, b);
    }
    else {
        typeId = type.dictionary.typeId;
        dictionaryOffset = typeAssembler.visit(type, b);
        typeOffset = typeAssembler.visit(type.dictionary, b);
    }
    const childOffsets = (type.children || []).map((f) => Field.encode(b, f));
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
    if (nameOffset !== -1) {
        _Field.addName(b, nameOffset);
    }
    if (dictionaryOffset !== -1) {
        _Field.addDictionary(b, dictionaryOffset);
    }
    if (metadataOffset !== -1) {
        _Field.addCustomMetadata(b, metadataOffset);
    }
    return _Field.endField(b);
}
/** @ignore */
function encodeRecordBatch(b, recordBatch) {
    const nodes = recordBatch.nodes || [];
    const buffers = recordBatch.buffers || [];
    _RecordBatch.startNodesVector(b, nodes.length);
    for (const n of nodes.slice().reverse())
        FieldNode.encode(b, n);
    const nodesVectorOffset = b.endVector();
    _RecordBatch.startBuffersVector(b, buffers.length);
    for (const b_ of buffers.slice().reverse())
        BufferRegion.encode(b, b_);
    const buffersVectorOffset = b.endVector();
    _RecordBatch.startRecordBatch(b);
    _RecordBatch.addLength(b, BigInt(recordBatch.length));
    _RecordBatch.addNodes(b, nodesVectorOffset);
    _RecordBatch.addBuffers(b, buffersVectorOffset);
    return _RecordBatch.endRecordBatch(b);
}
/** @ignore */
function encodeDictionaryBatch(b, dictionaryBatch) {
    const dataOffset = RecordBatch.encode(b, dictionaryBatch.data);
    _DictionaryBatch.startDictionaryBatch(b);
    _DictionaryBatch.addId(b, BigInt(dictionaryBatch.id));
    _DictionaryBatch.addIsDelta(b, dictionaryBatch.isDelta);
    _DictionaryBatch.addData(b, dataOffset);
    return _DictionaryBatch.endDictionaryBatch(b);
}
/** @ignore */
function encodeFieldNode(b, node) {
    return _FieldNode.createFieldNode(b, BigInt(node.length), BigInt(node.nullCount));
}
/** @ignore */
function encodeBufferRegion(b, node) {
    return _Buffer.createBuffer(b, BigInt(node.offset), BigInt(node.length));
}
/** @ignore */
const platformIsLittleEndian = (() => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
    // Int16Array uses the platform's endianness.
    return new Int16Array(buffer)[0] === 256;
})();

//# sourceMappingURL=message.mjs.map
