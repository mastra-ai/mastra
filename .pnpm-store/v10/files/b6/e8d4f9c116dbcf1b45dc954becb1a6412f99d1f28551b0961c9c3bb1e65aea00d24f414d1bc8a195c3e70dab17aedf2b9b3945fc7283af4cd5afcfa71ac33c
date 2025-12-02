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
exports.FileBlock = exports.Footer = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const block_js_1 = require("../../fb/block.js");
const footer_js_1 = require("../../fb/footer.js");
const flatbuffers = require("flatbuffers");
var Builder = flatbuffers.Builder;
var ByteBuffer = flatbuffers.ByteBuffer;
const schema_js_1 = require("../../schema.js");
const enum_js_1 = require("../../enum.js");
const buffer_js_1 = require("../../util/buffer.js");
const bigint_js_1 = require("../../util/bigint.js");
/** @ignore */
class Footer_ {
    /** @nocollapse */
    static decode(buf) {
        buf = new ByteBuffer((0, buffer_js_1.toUint8Array)(buf));
        const footer = footer_js_1.Footer.getRootAsFooter(buf);
        const schema = schema_js_1.Schema.decode(footer.schema(), new Map(), footer.version());
        return new OffHeapFooter(schema, footer);
    }
    /** @nocollapse */
    static encode(footer) {
        const b = new Builder();
        const schemaOffset = schema_js_1.Schema.encode(b, footer.schema);
        footer_js_1.Footer.startRecordBatchesVector(b, footer.numRecordBatches);
        for (const rb of [...footer.recordBatches()].slice().reverse()) {
            FileBlock.encode(b, rb);
        }
        const recordBatchesOffset = b.endVector();
        footer_js_1.Footer.startDictionariesVector(b, footer.numDictionaries);
        for (const db of [...footer.dictionaryBatches()].slice().reverse()) {
            FileBlock.encode(b, db);
        }
        const dictionaryBatchesOffset = b.endVector();
        footer_js_1.Footer.startFooter(b);
        footer_js_1.Footer.addSchema(b, schemaOffset);
        footer_js_1.Footer.addVersion(b, enum_js_1.MetadataVersion.V5);
        footer_js_1.Footer.addRecordBatches(b, recordBatchesOffset);
        footer_js_1.Footer.addDictionaries(b, dictionaryBatchesOffset);
        footer_js_1.Footer.finishFooterBuffer(b, footer_js_1.Footer.endFooter(b));
        return b.asUint8Array();
    }
    get numRecordBatches() { return this._recordBatches.length; }
    get numDictionaries() { return this._dictionaryBatches.length; }
    constructor(schema, version = enum_js_1.MetadataVersion.V5, recordBatches, dictionaryBatches) {
        this.schema = schema;
        this.version = version;
        recordBatches && (this._recordBatches = recordBatches);
        dictionaryBatches && (this._dictionaryBatches = dictionaryBatches);
    }
    *recordBatches() {
        for (let block, i = -1, n = this.numRecordBatches; ++i < n;) {
            if (block = this.getRecordBatch(i)) {
                yield block;
            }
        }
    }
    *dictionaryBatches() {
        for (let block, i = -1, n = this.numDictionaries; ++i < n;) {
            if (block = this.getDictionaryBatch(i)) {
                yield block;
            }
        }
    }
    getRecordBatch(index) {
        return index >= 0
            && index < this.numRecordBatches
            && this._recordBatches[index] || null;
    }
    getDictionaryBatch(index) {
        return index >= 0
            && index < this.numDictionaries
            && this._dictionaryBatches[index] || null;
    }
}
exports.Footer = Footer_;
/** @ignore */
class OffHeapFooter extends Footer_ {
    get numRecordBatches() { return this._footer.recordBatchesLength(); }
    get numDictionaries() { return this._footer.dictionariesLength(); }
    constructor(schema, _footer) {
        super(schema, _footer.version());
        this._footer = _footer;
    }
    getRecordBatch(index) {
        if (index >= 0 && index < this.numRecordBatches) {
            const fileBlock = this._footer.recordBatches(index);
            if (fileBlock) {
                return FileBlock.decode(fileBlock);
            }
        }
        return null;
    }
    getDictionaryBatch(index) {
        if (index >= 0 && index < this.numDictionaries) {
            const fileBlock = this._footer.dictionaries(index);
            if (fileBlock) {
                return FileBlock.decode(fileBlock);
            }
        }
        return null;
    }
}
/** @ignore */
class FileBlock {
    /** @nocollapse */
    static decode(block) {
        return new FileBlock(block.metaDataLength(), block.bodyLength(), block.offset());
    }
    /** @nocollapse */
    static encode(b, fileBlock) {
        const { metaDataLength } = fileBlock;
        const offset = BigInt(fileBlock.offset);
        const bodyLength = BigInt(fileBlock.bodyLength);
        return block_js_1.Block.createBlock(b, offset, metaDataLength, bodyLength);
    }
    constructor(metaDataLength, bodyLength, offset) {
        this.metaDataLength = metaDataLength;
        this.offset = (0, bigint_js_1.bigIntToNumber)(offset);
        this.bodyLength = (0, bigint_js_1.bigIntToNumber)(bodyLength);
    }
}
exports.FileBlock = FileBlock;

//# sourceMappingURL=file.js.map
