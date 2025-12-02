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

/* eslint-disable @typescript-eslint/naming-convention */

import { Block as _Block } from '../../fb/block.js';
import { Footer as _Footer } from '../../fb/footer.js';

import * as flatbuffers from 'flatbuffers';

import Builder = flatbuffers.Builder;
import ByteBuffer = flatbuffers.ByteBuffer;

import { Schema } from '../../schema.js';
import { MetadataVersion } from '../../enum.js';
import { toUint8Array } from '../../util/buffer.js';
import { ArrayBufferViewInput } from '../../util/buffer.js';
import { bigIntToNumber } from '../../util/bigint.js';

/** @ignore */
class Footer_ {

    /** @nocollapse */
    public static decode(buf: ArrayBufferViewInput) {
        buf = new ByteBuffer(toUint8Array(buf));
        const footer = _Footer.getRootAsFooter(buf);
        const schema = Schema.decode(footer.schema()!, new Map(), footer.version());
        return new OffHeapFooter(schema, footer) as Footer_;
    }

    /** @nocollapse */
    public static encode(footer: Footer_) {

        const b: Builder = new Builder();
        const schemaOffset = Schema.encode(b, footer.schema);

        _Footer.startRecordBatchesVector(b, footer.numRecordBatches);
        for (const rb of [...footer.recordBatches()].slice().reverse()) {
            FileBlock.encode(b, rb);
        }
        const recordBatchesOffset = b.endVector();

        _Footer.startDictionariesVector(b, footer.numDictionaries);
        for (const db of [...footer.dictionaryBatches()].slice().reverse()) {
            FileBlock.encode(b, db);
        }

        const dictionaryBatchesOffset = b.endVector();

        _Footer.startFooter(b);
        _Footer.addSchema(b, schemaOffset);
        _Footer.addVersion(b, MetadataVersion.V5);
        _Footer.addRecordBatches(b, recordBatchesOffset);
        _Footer.addDictionaries(b, dictionaryBatchesOffset);
        _Footer.finishFooterBuffer(b, _Footer.endFooter(b));

        return b.asUint8Array();
    }

    declare protected _recordBatches: FileBlock[];
    declare protected _dictionaryBatches: FileBlock[];
    public get numRecordBatches() { return this._recordBatches.length; }
    public get numDictionaries() { return this._dictionaryBatches.length; }

    constructor(public schema: Schema,
        public version: MetadataVersion = MetadataVersion.V5,
        recordBatches?: FileBlock[], dictionaryBatches?: FileBlock[]) {
        recordBatches && (this._recordBatches = recordBatches);
        dictionaryBatches && (this._dictionaryBatches = dictionaryBatches);
    }

    public *recordBatches(): Iterable<FileBlock> {
        for (let block, i = -1, n = this.numRecordBatches; ++i < n;) {
            if (block = this.getRecordBatch(i)) { yield block; }
        }
    }

    public *dictionaryBatches(): Iterable<FileBlock> {
        for (let block, i = -1, n = this.numDictionaries; ++i < n;) {
            if (block = this.getDictionaryBatch(i)) { yield block; }
        }
    }

    public getRecordBatch(index: number) {
        return index >= 0
            && index < this.numRecordBatches
            && this._recordBatches[index] || null;
    }

    public getDictionaryBatch(index: number) {
        return index >= 0
            && index < this.numDictionaries
            && this._dictionaryBatches[index] || null;
    }
}

export { Footer_ as Footer };

/** @ignore */
class OffHeapFooter extends Footer_ {

    public get numRecordBatches() { return this._footer.recordBatchesLength(); }
    public get numDictionaries() { return this._footer.dictionariesLength(); }

    constructor(schema: Schema, protected _footer: _Footer) {
        super(schema, _footer.version());
    }

    public getRecordBatch(index: number) {
        if (index >= 0 && index < this.numRecordBatches) {
            const fileBlock = this._footer.recordBatches(index);
            if (fileBlock) { return FileBlock.decode(fileBlock); }
        }
        return null;
    }

    public getDictionaryBatch(index: number) {
        if (index >= 0 && index < this.numDictionaries) {
            const fileBlock = this._footer.dictionaries(index);
            if (fileBlock) { return FileBlock.decode(fileBlock); }
        }
        return null;
    }
}

/** @ignore */
export class FileBlock {

    /** @nocollapse */
    public static decode(block: _Block) {
        return new FileBlock(block.metaDataLength(), block.bodyLength(), block.offset());
    }

    /** @nocollapse */
    public static encode(b: Builder, fileBlock: FileBlock) {
        const { metaDataLength } = fileBlock;
        const offset = BigInt(fileBlock.offset);
        const bodyLength = BigInt(fileBlock.bodyLength);
        return _Block.createBlock(b, offset, metaDataLength, bodyLength);
    }

    public offset: number;
    public bodyLength: number;
    public metaDataLength: number;

    constructor(metaDataLength: number, bodyLength: bigint | number, offset: bigint | number) {
        this.metaDataLength = metaDataLength;
        this.offset = bigIntToNumber(offset);
        this.bodyLength = bigIntToNumber(bodyLength);
    }
}
