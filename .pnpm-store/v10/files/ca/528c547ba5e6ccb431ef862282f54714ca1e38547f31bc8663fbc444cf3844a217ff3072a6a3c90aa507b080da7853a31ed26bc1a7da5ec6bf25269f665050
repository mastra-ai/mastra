"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldNode = exports.BufferRegion = exports.DictionaryBatch = exports.RecordBatch = exports.Message = void 0;
/* eslint-disable brace-style */
const flatbuffers = require("flatbuffers");
const schema_js_1 = require("../../fb/schema.js");
const int_js_1 = require("../../fb/int.js");
const record_batch_js_1 = require("../../fb/record-batch.js");
const dictionary_batch_js_1 = require("../../fb/dictionary-batch.js");
const buffer_js_1 = require("../../fb/buffer.js");
const field_js_1 = require("../../fb/field.js");
const field_node_js_1 = require("../../fb/field-node.js");
const type_js_1 = require("../../fb/type.js");
const key_value_js_1 = require("../../fb/key-value.js");
const endianness_js_1 = require("../../fb/endianness.js");
const floating_point_js_1 = require("../../fb/floating-point.js");
const decimal_js_1 = require("../../fb/decimal.js");
const date_js_1 = require("../../fb/date.js");
const time_js_1 = require("../../fb/time.js");
const timestamp_js_1 = require("../../fb/timestamp.js");
const interval_js_1 = require("../../fb/interval.js");
const duration_js_1 = require("../../fb/duration.js");
const union_js_1 = require("../../fb/union.js");
const fixed_size_binary_js_1 = require("../../fb/fixed-size-binary.js");
const fixed_size_list_js_1 = require("../../fb/fixed-size-list.js");
const map_js_1 = require("../../fb/map.js");
const message_js_1 = require("../../fb/message.js");
const schema_js_2 = require("../../schema.js");
const buffer_js_2 = require("../../util/buffer.js");
const bigint_js_1 = require("../../util/bigint.js");
const enum_js_1 = require("../../enum.js");
const typeassembler_js_1 = require("../../visitor/typeassembler.js");
const json_js_1 = require("./json.js");
var Builder = flatbuffers.Builder;
var ByteBuffer = flatbuffers.ByteBuffer;
const type_js_2 = require("../../type.js");
/**
 * @ignore
 * @private
 **/
class Message {
    /** @nocollapse */
    static fromJSON(msg, headerType) {
        const message = new Message(0, enum_js_1.MetadataVersion.V5, headerType);
        message._createHeader = messageHeaderFromJSON(msg, headerType);
        return message;
    }
    /** @nocollapse */
    static decode(buf) {
        buf = new ByteBuffer((0, buffer_js_2.toUint8Array)(buf));
        const _message = message_js_1.Message.getRootAsMessage(buf);
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
            headerOffset = schema_js_2.Schema.encode(b, message.header());
        }
        else if (message.isRecordBatch()) {
            headerOffset = RecordBatch.encode(b, message.header());
        }
        else if (message.isDictionaryBatch()) {
            headerOffset = DictionaryBatch.encode(b, message.header());
        }
        message_js_1.Message.startMessage(b);
        message_js_1.Message.addVersion(b, enum_js_1.MetadataVersion.V5);
        message_js_1.Message.addHeader(b, headerOffset);
        message_js_1.Message.addHeaderType(b, message.headerType);
        message_js_1.Message.addBodyLength(b, BigInt(message.bodyLength));
        message_js_1.Message.finishMessageBuffer(b, message_js_1.Message.endMessage(b));
        return b.asUint8Array();
    }
    /** @nocollapse */
    static from(header, bodyLength = 0) {
        if (header instanceof schema_js_2.Schema) {
            return new Message(0, enum_js_1.MetadataVersion.V5, enum_js_1.MessageHeader.Schema, header);
        }
        if (header instanceof RecordBatch) {
            return new Message(bodyLength, enum_js_1.MetadataVersion.V5, enum_js_1.MessageHeader.RecordBatch, header);
        }
        if (header instanceof DictionaryBatch) {
            return new Message(bodyLength, enum_js_1.MetadataVersion.V5, enum_js_1.MessageHeader.DictionaryBatch, header);
        }
        throw new Error(`Unrecognized Message header: ${header}`);
    }
    get type() { return this.headerType; }
    get version() { return this._version; }
    get headerType() { return this._headerType; }
    get bodyLength() { return this._bodyLength; }
    header() { return this._createHeader(); }
    isSchema() { return this.headerType === enum_js_1.MessageHeader.Schema; }
    isRecordBatch() { return this.headerType === enum_js_1.MessageHeader.RecordBatch; }
    isDictionaryBatch() { return this.headerType === enum_js_1.MessageHeader.DictionaryBatch; }
    constructor(bodyLength, version, headerType, header) {
        this._version = version;
        this._headerType = headerType;
        this.body = new Uint8Array(0);
        header && (this._createHeader = () => header);
        this._bodyLength = (0, bigint_js_1.bigIntToNumber)(bodyLength);
    }
}
exports.Message = Message;
/**
 * @ignore
 * @private
 **/
class RecordBatch {
    get nodes() { return this._nodes; }
    get length() { return this._length; }
    get buffers() { return this._buffers; }
    constructor(length, nodes, buffers) {
        this._nodes = nodes;
        this._buffers = buffers;
        this._length = (0, bigint_js_1.bigIntToNumber)(length);
    }
}
exports.RecordBatch = RecordBatch;
/**
 * @ignore
 * @private
 **/
class DictionaryBatch {
    get id() { return this._id; }
    get data() { return this._data; }
    get isDelta() { return this._isDelta; }
    get length() { return this.data.length; }
    get nodes() { return this.data.nodes; }
    get buffers() { return this.data.buffers; }
    constructor(data, id, isDelta = false) {
        this._data = data;
        this._isDelta = isDelta;
        this._id = (0, bigint_js_1.bigIntToNumber)(id);
    }
}
exports.DictionaryBatch = DictionaryBatch;
/**
 * @ignore
 * @private
 **/
class BufferRegion {
    constructor(offset, length) {
        this.offset = (0, bigint_js_1.bigIntToNumber)(offset);
        this.length = (0, bigint_js_1.bigIntToNumber)(length);
    }
}
exports.BufferRegion = BufferRegion;
/**
 * @ignore
 * @private
 **/
class FieldNode {
    constructor(length, nullCount) {
        this.length = (0, bigint_js_1.bigIntToNumber)(length);
        this.nullCount = (0, bigint_js_1.bigIntToNumber)(nullCount);
    }
}
exports.FieldNode = FieldNode;
/** @ignore */
function messageHeaderFromJSON(message, type) {
    return (() => {
        switch (type) {
            case enum_js_1.MessageHeader.Schema: return schema_js_2.Schema.fromJSON(message);
            case enum_js_1.MessageHeader.RecordBatch: return RecordBatch.fromJSON(message);
            case enum_js_1.MessageHeader.DictionaryBatch: return DictionaryBatch.fromJSON(message);
        }
        throw new Error(`Unrecognized Message type: { name: ${enum_js_1.MessageHeader[type]}, type: ${type} }`);
    });
}
/** @ignore */
function decodeMessageHeader(message, type) {
    return (() => {
        switch (type) {
            case enum_js_1.MessageHeader.Schema: return schema_js_2.Schema.decode(message.header(new schema_js_1.Schema()), new Map(), message.version());
            case enum_js_1.MessageHeader.RecordBatch: return RecordBatch.decode(message.header(new record_batch_js_1.RecordBatch()), message.version());
            case enum_js_1.MessageHeader.DictionaryBatch: return DictionaryBatch.decode(message.header(new dictionary_batch_js_1.DictionaryBatch()), message.version());
        }
        throw new Error(`Unrecognized Message type: { name: ${enum_js_1.MessageHeader[type]}, type: ${type} }`);
    });
}
schema_js_2.Field['encode'] = encodeField;
schema_js_2.Field['decode'] = decodeField;
schema_js_2.Field['fromJSON'] = json_js_1.fieldFromJSON;
schema_js_2.Schema['encode'] = encodeSchema;
schema_js_2.Schema['decode'] = decodeSchema;
schema_js_2.Schema['fromJSON'] = json_js_1.schemaFromJSON;
RecordBatch['encode'] = encodeRecordBatch;
RecordBatch['decode'] = decodeRecordBatch;
RecordBatch['fromJSON'] = json_js_1.recordBatchFromJSON;
DictionaryBatch['encode'] = encodeDictionaryBatch;
DictionaryBatch['decode'] = decodeDictionaryBatch;
DictionaryBatch['fromJSON'] = json_js_1.dictionaryBatchFromJSON;
FieldNode['encode'] = encodeFieldNode;
FieldNode['decode'] = decodeFieldNode;
BufferRegion['encode'] = encodeBufferRegion;
BufferRegion['decode'] = decodeBufferRegion;
/** @ignore */
function decodeSchema(_schema, dictionaries = new Map(), version = enum_js_1.MetadataVersion.V5) {
    const fields = decodeSchemaFields(_schema, dictionaries);
    return new schema_js_2.Schema(fields, decodeCustomMetadata(_schema), dictionaries, version);
}
/** @ignore */
function decodeRecordBatch(batch, version = enum_js_1.MetadataVersion.V5) {
    if (batch.compression() !== null) {
        throw new Error('Record batch compression not implemented');
    }
    return new RecordBatch(batch.length(), decodeFieldNodes(batch), decodeBuffers(batch, version));
}
/** @ignore */
function decodeDictionaryBatch(batch, version = enum_js_1.MetadataVersion.V5) {
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
            if (version < enum_js_1.MetadataVersion.V4) {
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
            fields[++j] = schema_js_2.Field.decode(f, dictionaries);
        }
    }
    return fields;
}
/** @ignore */
function decodeFieldChildren(field, dictionaries) {
    const children = [];
    for (let f, i = -1, j = -1, n = field.childrenLength(); ++i < n;) {
        if (f = field.children(i)) {
            children[++j] = schema_js_2.Field.decode(f, dictionaries);
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
        field = new schema_js_2.Field(f.name(), type, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded and the first time we've seen this dictionary id, decode
    // the data type and child fields, then wrap in a Dictionary type and insert the
    // data type into the dictionary types map.
    else if (!dictionaries.has(id = (0, bigint_js_1.bigIntToNumber)(dictMeta.id()))) {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new type_js_2.Int32();
        dictionaries.set(id, type = decodeFieldType(f, decodeFieldChildren(f, dictionaries)));
        dictType = new type_js_2.Dictionary(type, keys, id, dictMeta.isOrdered());
        field = new schema_js_2.Field(f.name(), dictType, f.nullable(), decodeCustomMetadata(f));
    }
    // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
    // data type and wrap in a new Dictionary type and field.
    else {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta.indexType()) ? decodeIndexType(keys) : new type_js_2.Int32();
        dictType = new type_js_2.Dictionary(dictionaries.get(id), keys, id, dictMeta.isOrdered());
        field = new schema_js_2.Field(f.name(), dictType, f.nullable(), decodeCustomMetadata(f));
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
    return new type_js_2.Int(_type.isSigned(), _type.bitWidth());
}
/** @ignore */
function decodeFieldType(f, children) {
    const typeId = f.typeType();
    switch (typeId) {
        case type_js_1.Type['NONE']: return new type_js_2.Null();
        case type_js_1.Type['Null']: return new type_js_2.Null();
        case type_js_1.Type['Binary']: return new type_js_2.Binary();
        case type_js_1.Type['LargeBinary']: return new type_js_2.LargeBinary();
        case type_js_1.Type['Utf8']: return new type_js_2.Utf8();
        case type_js_1.Type['LargeUtf8']: return new type_js_2.LargeUtf8();
        case type_js_1.Type['Bool']: return new type_js_2.Bool();
        case type_js_1.Type['List']: return new type_js_2.List((children || [])[0]);
        case type_js_1.Type['Struct_']: return new type_js_2.Struct(children || []);
    }
    switch (typeId) {
        case type_js_1.Type['Int']: {
            const t = f.type(new int_js_1.Int());
            return new type_js_2.Int(t.isSigned(), t.bitWidth());
        }
        case type_js_1.Type['FloatingPoint']: {
            const t = f.type(new floating_point_js_1.FloatingPoint());
            return new type_js_2.Float(t.precision());
        }
        case type_js_1.Type['Decimal']: {
            const t = f.type(new decimal_js_1.Decimal());
            return new type_js_2.Decimal(t.scale(), t.precision(), t.bitWidth());
        }
        case type_js_1.Type['Date']: {
            const t = f.type(new date_js_1.Date());
            return new type_js_2.Date_(t.unit());
        }
        case type_js_1.Type['Time']: {
            const t = f.type(new time_js_1.Time());
            return new type_js_2.Time(t.unit(), t.bitWidth());
        }
        case type_js_1.Type['Timestamp']: {
            const t = f.type(new timestamp_js_1.Timestamp());
            return new type_js_2.Timestamp(t.unit(), t.timezone());
        }
        case type_js_1.Type['Interval']: {
            const t = f.type(new interval_js_1.Interval());
            return new type_js_2.Interval(t.unit());
        }
        case type_js_1.Type['Duration']: {
            const t = f.type(new duration_js_1.Duration());
            return new type_js_2.Duration(t.unit());
        }
        case type_js_1.Type['Union']: {
            const t = f.type(new union_js_1.Union());
            return new type_js_2.Union(t.mode(), t.typeIdsArray() || [], children || []);
        }
        case type_js_1.Type['FixedSizeBinary']: {
            const t = f.type(new fixed_size_binary_js_1.FixedSizeBinary());
            return new type_js_2.FixedSizeBinary(t.byteWidth());
        }
        case type_js_1.Type['FixedSizeList']: {
            const t = f.type(new fixed_size_list_js_1.FixedSizeList());
            return new type_js_2.FixedSizeList(t.listSize(), (children || [])[0]);
        }
        case type_js_1.Type['Map']: {
            const t = f.type(new map_js_1.Map());
            return new type_js_2.Map_((children || [])[0], t.keysSorted());
        }
    }
    throw new Error(`Unrecognized type: "${type_js_1.Type[typeId]}" (${typeId})`);
}
/** @ignore */
function encodeSchema(b, schema) {
    const fieldOffsets = schema.fields.map((f) => schema_js_2.Field.encode(b, f));
    schema_js_1.Schema.startFieldsVector(b, fieldOffsets.length);
    const fieldsVectorOffset = schema_js_1.Schema.createFieldsVector(b, fieldOffsets);
    const metadataOffset = !(schema.metadata && schema.metadata.size > 0) ? -1 :
        schema_js_1.Schema.createCustomMetadataVector(b, [...schema.metadata].map(([k, v]) => {
            const key = b.createString(`${k}`);
            const val = b.createString(`${v}`);
            key_value_js_1.KeyValue.startKeyValue(b);
            key_value_js_1.KeyValue.addKey(b, key);
            key_value_js_1.KeyValue.addValue(b, val);
            return key_value_js_1.KeyValue.endKeyValue(b);
        }));
    schema_js_1.Schema.startSchema(b);
    schema_js_1.Schema.addFields(b, fieldsVectorOffset);
    schema_js_1.Schema.addEndianness(b, platformIsLittleEndian ? endianness_js_1.Endianness.Little : endianness_js_1.Endianness.Big);
    if (metadataOffset !== -1) {
        schema_js_1.Schema.addCustomMetadata(b, metadataOffset);
    }
    return schema_js_1.Schema.endSchema(b);
}
/** @ignore */
function encodeField(b, field) {
    let nameOffset = -1;
    let typeOffset = -1;
    let dictionaryOffset = -1;
    const type = field.type;
    let typeId = field.typeId;
    if (!type_js_2.DataType.isDictionary(type)) {
        typeOffset = typeassembler_js_1.instance.visit(type, b);
    }
    else {
        typeId = type.dictionary.typeId;
        dictionaryOffset = typeassembler_js_1.instance.visit(type, b);
        typeOffset = typeassembler_js_1.instance.visit(type.dictionary, b);
    }
    const childOffsets = (type.children || []).map((f) => schema_js_2.Field.encode(b, f));
    const childrenVectorOffset = field_js_1.Field.createChildrenVector(b, childOffsets);
    const metadataOffset = !(field.metadata && field.metadata.size > 0) ? -1 :
        field_js_1.Field.createCustomMetadataVector(b, [...field.metadata].map(([k, v]) => {
            const key = b.createString(`${k}`);
            const val = b.createString(`${v}`);
            key_value_js_1.KeyValue.startKeyValue(b);
            key_value_js_1.KeyValue.addKey(b, key);
            key_value_js_1.KeyValue.addValue(b, val);
            return key_value_js_1.KeyValue.endKeyValue(b);
        }));
    if (field.name) {
        nameOffset = b.createString(field.name);
    }
    field_js_1.Field.startField(b);
    field_js_1.Field.addType(b, typeOffset);
    field_js_1.Field.addTypeType(b, typeId);
    field_js_1.Field.addChildren(b, childrenVectorOffset);
    field_js_1.Field.addNullable(b, !!field.nullable);
    if (nameOffset !== -1) {
        field_js_1.Field.addName(b, nameOffset);
    }
    if (dictionaryOffset !== -1) {
        field_js_1.Field.addDictionary(b, dictionaryOffset);
    }
    if (metadataOffset !== -1) {
        field_js_1.Field.addCustomMetadata(b, metadataOffset);
    }
    return field_js_1.Field.endField(b);
}
/** @ignore */
function encodeRecordBatch(b, recordBatch) {
    const nodes = recordBatch.nodes || [];
    const buffers = recordBatch.buffers || [];
    record_batch_js_1.RecordBatch.startNodesVector(b, nodes.length);
    for (const n of nodes.slice().reverse())
        FieldNode.encode(b, n);
    const nodesVectorOffset = b.endVector();
    record_batch_js_1.RecordBatch.startBuffersVector(b, buffers.length);
    for (const b_ of buffers.slice().reverse())
        BufferRegion.encode(b, b_);
    const buffersVectorOffset = b.endVector();
    record_batch_js_1.RecordBatch.startRecordBatch(b);
    record_batch_js_1.RecordBatch.addLength(b, BigInt(recordBatch.length));
    record_batch_js_1.RecordBatch.addNodes(b, nodesVectorOffset);
    record_batch_js_1.RecordBatch.addBuffers(b, buffersVectorOffset);
    return record_batch_js_1.RecordBatch.endRecordBatch(b);
}
/** @ignore */
function encodeDictionaryBatch(b, dictionaryBatch) {
    const dataOffset = RecordBatch.encode(b, dictionaryBatch.data);
    dictionary_batch_js_1.DictionaryBatch.startDictionaryBatch(b);
    dictionary_batch_js_1.DictionaryBatch.addId(b, BigInt(dictionaryBatch.id));
    dictionary_batch_js_1.DictionaryBatch.addIsDelta(b, dictionaryBatch.isDelta);
    dictionary_batch_js_1.DictionaryBatch.addData(b, dataOffset);
    return dictionary_batch_js_1.DictionaryBatch.endDictionaryBatch(b);
}
/** @ignore */
function encodeFieldNode(b, node) {
    return field_node_js_1.FieldNode.createFieldNode(b, BigInt(node.length), BigInt(node.nullCount));
}
/** @ignore */
function encodeBufferRegion(b, node) {
    return buffer_js_1.Buffer.createBuffer(b, BigInt(node.offset), BigInt(node.length));
}
/** @ignore */
const platformIsLittleEndian = (() => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
    // Int16Array uses the platform's endianness.
    return new Int16Array(buffer)[0] === 256;
})();

//# sourceMappingURL=message.js.map
