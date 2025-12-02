import * as flatbuffers from 'flatbuffers';
import { Block } from './block.js';
import { KeyValue } from './key-value.js';
import { MetadataVersion } from './metadata-version.js';
import { Schema } from './schema.js';
/**
 * ----------------------------------------------------------------------
 * Arrow File metadata
 *
 */
export declare class Footer {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Footer;
    static getRootAsFooter(bb: flatbuffers.ByteBuffer, obj?: Footer): Footer;
    static getSizePrefixedRootAsFooter(bb: flatbuffers.ByteBuffer, obj?: Footer): Footer;
    version(): MetadataVersion;
    schema(obj?: Schema): Schema | null;
    dictionaries(index: number, obj?: Block): Block | null;
    dictionariesLength(): number;
    recordBatches(index: number, obj?: Block): Block | null;
    recordBatchesLength(): number;
    /**
     * User-defined metadata
     */
    customMetadata(index: number, obj?: KeyValue): KeyValue | null;
    customMetadataLength(): number;
    static startFooter(builder: flatbuffers.Builder): void;
    static addVersion(builder: flatbuffers.Builder, version: MetadataVersion): void;
    static addSchema(builder: flatbuffers.Builder, schemaOffset: flatbuffers.Offset): void;
    static addDictionaries(builder: flatbuffers.Builder, dictionariesOffset: flatbuffers.Offset): void;
    static startDictionariesVector(builder: flatbuffers.Builder, numElems: number): void;
    static addRecordBatches(builder: flatbuffers.Builder, recordBatchesOffset: flatbuffers.Offset): void;
    static startRecordBatchesVector(builder: flatbuffers.Builder, numElems: number): void;
    static addCustomMetadata(builder: flatbuffers.Builder, customMetadataOffset: flatbuffers.Offset): void;
    static createCustomMetadataVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startCustomMetadataVector(builder: flatbuffers.Builder, numElems: number): void;
    static endFooter(builder: flatbuffers.Builder): flatbuffers.Offset;
    static finishFooterBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
    static finishSizePrefixedFooterBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
}
