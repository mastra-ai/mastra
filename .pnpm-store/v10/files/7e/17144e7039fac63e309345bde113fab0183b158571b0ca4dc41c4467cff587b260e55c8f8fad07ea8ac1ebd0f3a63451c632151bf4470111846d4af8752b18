import * as flatbuffers from 'flatbuffers';
export declare class FixedSizeBinary {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): FixedSizeBinary;
    static getRootAsFixedSizeBinary(bb: flatbuffers.ByteBuffer, obj?: FixedSizeBinary): FixedSizeBinary;
    static getSizePrefixedRootAsFixedSizeBinary(bb: flatbuffers.ByteBuffer, obj?: FixedSizeBinary): FixedSizeBinary;
    /**
     * Number of bytes per value
     */
    byteWidth(): number;
    static startFixedSizeBinary(builder: flatbuffers.Builder): void;
    static addByteWidth(builder: flatbuffers.Builder, byteWidth: number): void;
    static endFixedSizeBinary(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createFixedSizeBinary(builder: flatbuffers.Builder, byteWidth: number): flatbuffers.Offset;
}
