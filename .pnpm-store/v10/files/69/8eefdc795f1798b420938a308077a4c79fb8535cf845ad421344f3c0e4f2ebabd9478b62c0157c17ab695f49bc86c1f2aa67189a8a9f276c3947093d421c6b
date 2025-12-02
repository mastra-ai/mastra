import * as flatbuffers from 'flatbuffers';
import { DictionaryEncoding } from './dictionary-encoding.js';
import { KeyValue } from './key-value.js';
import { Type } from './type.js';
/**
 * ----------------------------------------------------------------------
 * A field represents a named column in a record / row batch or child of a
 * nested type.
 */
export declare class Field {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Field;
    static getRootAsField(bb: flatbuffers.ByteBuffer, obj?: Field): Field;
    static getSizePrefixedRootAsField(bb: flatbuffers.ByteBuffer, obj?: Field): Field;
    /**
     * Name is not required, in i.e. a List
     */
    name(): string | null;
    name(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    /**
     * Whether or not this field can contain nulls. Should be true in general.
     */
    nullable(): boolean;
    typeType(): Type;
    /**
     * This is the type of the decoded value if the field is dictionary encoded.
     */
    type(obj: any): any | null;
    /**
     * Present only if the field is dictionary encoded.
     */
    dictionary(obj?: DictionaryEncoding): DictionaryEncoding | null;
    /**
     * children apply only to nested data types like Struct, List and Union. For
     * primitive types children will have length 0.
     */
    children(index: number, obj?: Field): Field | null;
    childrenLength(): number;
    /**
     * User-defined metadata
     */
    customMetadata(index: number, obj?: KeyValue): KeyValue | null;
    customMetadataLength(): number;
    static startField(builder: flatbuffers.Builder): void;
    static addName(builder: flatbuffers.Builder, nameOffset: flatbuffers.Offset): void;
    static addNullable(builder: flatbuffers.Builder, nullable: boolean): void;
    static addTypeType(builder: flatbuffers.Builder, typeType: Type): void;
    static addType(builder: flatbuffers.Builder, typeOffset: flatbuffers.Offset): void;
    static addDictionary(builder: flatbuffers.Builder, dictionaryOffset: flatbuffers.Offset): void;
    static addChildren(builder: flatbuffers.Builder, childrenOffset: flatbuffers.Offset): void;
    static createChildrenVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startChildrenVector(builder: flatbuffers.Builder, numElems: number): void;
    static addCustomMetadata(builder: flatbuffers.Builder, customMetadataOffset: flatbuffers.Offset): void;
    static createCustomMetadataVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startCustomMetadataVector(builder: flatbuffers.Builder, numElems: number): void;
    static endField(builder: flatbuffers.Builder): flatbuffers.Offset;
}
