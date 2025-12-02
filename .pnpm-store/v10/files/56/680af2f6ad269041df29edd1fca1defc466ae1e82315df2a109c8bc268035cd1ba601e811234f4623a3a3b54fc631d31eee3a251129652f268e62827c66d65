import * as flatbuffers from 'flatbuffers';
/**
 * Same as Binary, but with 64-bit offsets, allowing to represent
 * extremely large data values.
 */
export declare class LargeBinary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): LargeBinary;
    static getRootAsLargeBinary(bb: flatbuffers.ByteBuffer, obj?: LargeBinary): LargeBinary;
    static getSizePrefixedRootAsLargeBinary(bb: flatbuffers.ByteBuffer, obj?: LargeBinary): LargeBinary;
    static startLargeBinary(builder: flatbuffers.Builder): void;
    static endLargeBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createLargeBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
}
