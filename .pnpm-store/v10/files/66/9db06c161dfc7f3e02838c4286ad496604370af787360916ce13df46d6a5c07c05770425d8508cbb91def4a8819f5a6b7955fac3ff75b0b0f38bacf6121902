import * as flatbuffers from 'flatbuffers';
import { DictionaryKind } from './dictionary-kind.js';
import { Int } from './int.js';
export declare class DictionaryEncoding {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): DictionaryEncoding;
    static getRootAsDictionaryEncoding(bb: flatbuffers.ByteBuffer, obj?: DictionaryEncoding): DictionaryEncoding;
    static getSizePrefixedRootAsDictionaryEncoding(bb: flatbuffers.ByteBuffer, obj?: DictionaryEncoding): DictionaryEncoding;
    /**
     * The known dictionary id in the application where this data is used. In
     * the file or streaming formats, the dictionary ids are found in the
     * DictionaryBatch messages
     */
    id(): bigint;
    /**
     * The dictionary indices are constrained to be non-negative integers. If
     * this field is null, the indices must be signed int32. To maximize
     * cross-language compatibility and performance, implementations are
     * recommended to prefer signed integer types over unsigned integer types
     * and to avoid uint64 indices unless they are required by an application.
     */
    indexType(obj?: Int): Int | null;
    /**
     * By default, dictionaries are not ordered, or the order does not have
     * semantic meaning. In some statistical, applications, dictionary-encoding
     * is used to represent ordered categorical data, and we provide a way to
     * preserve that metadata here
     */
    isOrdered(): boolean;
    dictionaryKind(): DictionaryKind;
    static startDictionaryEncoding(builder: flatbuffers.Builder): void;
    static addId(builder: flatbuffers.Builder, id: bigint): void;
    static addIndexType(builder: flatbuffers.Builder, indexTypeOffset: flatbuffers.Offset): void;
    static addIsOrdered(builder: flatbuffers.Builder, isOrdered: boolean): void;
    static addDictionaryKind(builder: flatbuffers.Builder, dictionaryKind: DictionaryKind): void;
    static endDictionaryEncoding(builder: flatbuffers.Builder): flatbuffers.Offset;
}
