import * as flatbuffers from 'flatbuffers';
export declare class Block {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Block;
    /**
     * Index to the start of the RecordBlock (note this is past the Message header)
     */
    offset(): bigint;
    /**
     * Length of the metadata
     */
    metaDataLength(): number;
    /**
     * Length of the data (this is aligned so there can be a gap between this and
     * the metadata).
     */
    bodyLength(): bigint;
    static sizeOf(): number;
    static createBlock(builder: flatbuffers.Builder, offset: bigint, metaDataLength: number, bodyLength: bigint): flatbuffers.Offset;
}
