import * as flatbuffers from 'flatbuffers';
/**
 * A Struct_ in the flatbuffer metadata is the same as an Arrow Struct
 * (according to the physical memory layout). We used Struct_ here as
 * Struct is a reserved word in Flatbuffers
 */
export declare class Struct_ {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Struct_;
    static getRootAsStruct_(bb: flatbuffers.ByteBuffer, obj?: Struct_): Struct_;
    static getSizePrefixedRootAsStruct_(bb: flatbuffers.ByteBuffer, obj?: Struct_): Struct_;
    static startStruct_(builder: flatbuffers.Builder): void;
    static endStruct_(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createStruct_(builder: flatbuffers.Builder): flatbuffers.Offset;
}
