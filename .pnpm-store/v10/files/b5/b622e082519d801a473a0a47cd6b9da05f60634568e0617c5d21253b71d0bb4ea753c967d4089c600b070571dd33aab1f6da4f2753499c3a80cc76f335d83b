import { Block as _Block } from '../../fb/block.js';
import * as flatbuffers from 'flatbuffers';
import Builder = flatbuffers.Builder;
import { Schema } from '../../schema.js';
import { MetadataVersion } from '../../enum.js';
import { ArrayBufferViewInput } from '../../util/buffer.js';
/** @ignore */
declare class Footer_ {
    schema: Schema;
    version: MetadataVersion;
    /** @nocollapse */
    static decode(buf: ArrayBufferViewInput): Footer_;
    /** @nocollapse */
    static encode(footer: Footer_): Uint8Array;
    protected _recordBatches: FileBlock[];
    protected _dictionaryBatches: FileBlock[];
    get numRecordBatches(): number;
    get numDictionaries(): number;
    constructor(schema: Schema, version?: MetadataVersion, recordBatches?: FileBlock[], dictionaryBatches?: FileBlock[]);
    recordBatches(): Iterable<FileBlock>;
    dictionaryBatches(): Iterable<FileBlock>;
    getRecordBatch(index: number): FileBlock | null;
    getDictionaryBatch(index: number): FileBlock | null;
}
export { Footer_ as Footer };
/** @ignore */
export declare class FileBlock {
    /** @nocollapse */
    static decode(block: _Block): FileBlock;
    /** @nocollapse */
    static encode(b: Builder, fileBlock: FileBlock): number;
    offset: number;
    bodyLength: number;
    metaDataLength: number;
    constructor(metaDataLength: number, bodyLength: bigint | number, offset: bigint | number);
}
