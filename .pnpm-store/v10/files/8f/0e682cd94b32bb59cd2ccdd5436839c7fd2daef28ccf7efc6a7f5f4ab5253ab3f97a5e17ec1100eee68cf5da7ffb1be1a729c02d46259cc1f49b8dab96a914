import * as flatbuffers from 'flatbuffers';
/**
 * Opaque binary data
 */
export declare class Binary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Binary;
    static getRootAsBinary(bb: flatbuffers.ByteBuffer, obj?: Binary): Binary;
    static getSizePrefixedRootAsBinary(bb: flatbuffers.ByteBuffer, obj?: Binary): Binary;
    static startBinary(builder: flatbuffers.Builder): void;
    static endBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
}
