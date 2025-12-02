import * as flatbuffers from 'flatbuffers';
import { RecordBatch } from './record-batch.js';
/**
 * For sending dictionary encoding information. Any Field can be
 * dictionary-encoded, but in this case none of its children may be
 * dictionary-encoded.
 * There is one vector / column per dictionary, but that vector / column
 * may be spread across multiple dictionary batches by using the isDelta
 * flag
 */
export declare class DictionaryBatch {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): DictionaryBatch;
    static getRootAsDictionaryBatch(bb: flatbuffers.ByteBuffer, obj?: DictionaryBatch): DictionaryBatch;
    static getSizePrefixedRootAsDictionaryBatch(bb: flatbuffers.ByteBuffer, obj?: DictionaryBatch): DictionaryBatch;
    id(): bigint;
    data(obj?: RecordBatch): RecordBatch | null;
    /**
     * If isDelta is true the values in the dictionary are to be appended to a
     * dictionary with the indicated id. If isDelta is false this dictionary
     * should replace the existing dictionary.
     */
    isDelta(): boolean;
    static startDictionaryBatch(builder: flatbuffers.Builder): void;
    static addId(builder: flatbuffers.Builder, id: bigint): void;
    static addData(builder: flatbuffers.Builder, dataOffset: flatbuffers.Offset): void;
    static addIsDelta(builder: flatbuffers.Builder, isDelta: boolean): void;
    static endDictionaryBatch(builder: flatbuffers.Builder): flatbuffers.Offset;
}
