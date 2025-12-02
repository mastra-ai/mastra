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
exports.JSONVectorLoader = exports.VectorLoader = void 0;
const data_js_1 = require("../data.js");
const schema_js_1 = require("../schema.js");
const type_js_1 = require("../type.js");
const visitor_js_1 = require("../visitor.js");
const bit_js_1 = require("../util/bit.js");
const utf8_js_1 = require("../util/utf8.js");
const int_js_1 = require("../util/int.js");
const enum_js_1 = require("../enum.js");
const buffer_js_1 = require("../util/buffer.js");
/** @ignore */
class VectorLoader extends visitor_js_1.Visitor {
    constructor(bytes, nodes, buffers, dictionaries, metadataVersion = enum_js_1.MetadataVersion.V5) {
        super();
        this.nodesIndex = -1;
        this.buffersIndex = -1;
        this.bytes = bytes;
        this.nodes = nodes;
        this.buffers = buffers;
        this.dictionaries = dictionaries;
        this.metadataVersion = metadataVersion;
    }
    visit(node) {
        return super.visit(node instanceof schema_js_1.Field ? node.type : node);
    }
    visitNull(type, { length } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length });
    }
    visitBool(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitInt(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitFloat(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitUtf8(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), data: this.readData(type) });
    }
    visitLargeUtf8(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), data: this.readData(type) });
    }
    visitBinary(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), data: this.readData(type) });
    }
    visitLargeBinary(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), data: this.readData(type) });
    }
    visitFixedSizeBinary(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitDate(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitTimestamp(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitTime(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitDecimal(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitList(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), 'child': this.visit(type.children[0]) });
    }
    visitStruct(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), children: this.visitMany(type.children) });
    }
    visitUnion(type, { length, nullCount } = this.nextFieldNode()) {
        if (this.metadataVersion < enum_js_1.MetadataVersion.V5) {
            this.readNullBitmap(type, nullCount);
        }
        return type.mode === enum_js_1.UnionMode.Sparse
            ? this.visitSparseUnion(type, { length, nullCount })
            : this.visitDenseUnion(type, { length, nullCount });
    }
    visitDenseUnion(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, typeIds: this.readTypeIds(type), valueOffsets: this.readOffsets(type), children: this.visitMany(type.children) });
    }
    visitSparseUnion(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, typeIds: this.readTypeIds(type), children: this.visitMany(type.children) });
    }
    visitDictionary(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type.indices), dictionary: this.readDictionary(type) });
    }
    visitInterval(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitDuration(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), data: this.readData(type) });
    }
    visitFixedSizeList(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), 'child': this.visit(type.children[0]) });
    }
    visitMap(type, { length, nullCount } = this.nextFieldNode()) {
        return (0, data_js_1.makeData)({ type, length, nullCount, nullBitmap: this.readNullBitmap(type, nullCount), valueOffsets: this.readOffsets(type), 'child': this.visit(type.children[0]) });
    }
    nextFieldNode() { return this.nodes[++this.nodesIndex]; }
    nextBufferRange() { return this.buffers[++this.buffersIndex]; }
    readNullBitmap(type, nullCount, buffer = this.nextBufferRange()) {
        return nullCount > 0 && this.readData(type, buffer) || new Uint8Array(0);
    }
    readOffsets(type, buffer) { return this.readData(type, buffer); }
    readTypeIds(type, buffer) { return this.readData(type, buffer); }
    readData(_type, { length, offset } = this.nextBufferRange()) {
        return this.bytes.subarray(offset, offset + length);
    }
    readDictionary(type) {
        return this.dictionaries.get(type.id);
    }
}
exports.VectorLoader = VectorLoader;
/** @ignore */
class JSONVectorLoader extends VectorLoader {
    constructor(sources, nodes, buffers, dictionaries, metadataVersion) {
        super(new Uint8Array(0), nodes, buffers, dictionaries, metadataVersion);
        this.sources = sources;
    }
    readNullBitmap(_type, nullCount, { offset } = this.nextBufferRange()) {
        return nullCount <= 0 ? new Uint8Array(0) : (0, bit_js_1.packBools)(this.sources[offset]);
    }
    readOffsets(_type, { offset } = this.nextBufferRange()) {
        return (0, buffer_js_1.toArrayBufferView)(Uint8Array, (0, buffer_js_1.toArrayBufferView)(_type.OffsetArrayType, this.sources[offset]));
    }
    readTypeIds(type, { offset } = this.nextBufferRange()) {
        return (0, buffer_js_1.toArrayBufferView)(Uint8Array, (0, buffer_js_1.toArrayBufferView)(type.ArrayType, this.sources[offset]));
    }
    readData(type, { offset } = this.nextBufferRange()) {
        const { sources } = this;
        if (type_js_1.DataType.isTimestamp(type)) {
            return (0, buffer_js_1.toArrayBufferView)(Uint8Array, int_js_1.Int64.convertArray(sources[offset]));
        }
        else if ((type_js_1.DataType.isInt(type) || type_js_1.DataType.isTime(type)) && type.bitWidth === 64 || type_js_1.DataType.isDuration(type)) {
            return (0, buffer_js_1.toArrayBufferView)(Uint8Array, int_js_1.Int64.convertArray(sources[offset]));
        }
        else if (type_js_1.DataType.isDate(type) && type.unit === enum_js_1.DateUnit.MILLISECOND) {
            return (0, buffer_js_1.toArrayBufferView)(Uint8Array, int_js_1.Int64.convertArray(sources[offset]));
        }
        else if (type_js_1.DataType.isDecimal(type)) {
            return (0, buffer_js_1.toArrayBufferView)(Uint8Array, int_js_1.Int128.convertArray(sources[offset]));
        }
        else if (type_js_1.DataType.isBinary(type) || type_js_1.DataType.isLargeBinary(type) || type_js_1.DataType.isFixedSizeBinary(type)) {
            return binaryDataFromJSON(sources[offset]);
        }
        else if (type_js_1.DataType.isBool(type)) {
            return (0, bit_js_1.packBools)(sources[offset]);
        }
        else if (type_js_1.DataType.isUtf8(type) || type_js_1.DataType.isLargeUtf8(type)) {
            return (0, utf8_js_1.encodeUtf8)(sources[offset].join(''));
        }
        return (0, buffer_js_1.toArrayBufferView)(Uint8Array, (0, buffer_js_1.toArrayBufferView)(type.ArrayType, sources[offset].map((x) => +x)));
    }
}
exports.JSONVectorLoader = JSONVectorLoader;
/** @ignore */
function binaryDataFromJSON(values) {
    // "DATA": ["49BC7D5B6C47D2","3F5FB6D9322026"]
    // There are definitely more efficient ways to do this... but it gets the
    // job done.
    const joined = values.join('');
    const data = new Uint8Array(joined.length / 2);
    for (let i = 0; i < joined.length; i += 2) {
        data[i >> 1] = Number.parseInt(joined.slice(i, i + 2), 16);
    }
    return data;
}

//# sourceMappingURL=vectorloader.js.map
