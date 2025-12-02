import * as flatbuffers from 'flatbuffers';
export declare class FixedSizeList {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): FixedSizeList;
    static getRootAsFixedSizeList(bb: flatbuffers.ByteBuffer, obj?: FixedSizeList): FixedSizeList;
    static getSizePrefixedRootAsFixedSizeList(bb: flatbuffers.ByteBuffer, obj?: FixedSizeList): FixedSizeList;
    /**
     * Number of list items per value
     */
    listSize(): number;
    static startFixedSizeList(builder: flatbuffers.Builder): void;
    static addListSize(builder: flatbuffers.Builder, listSize: number): void;
    static endFixedSizeList(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createFixedSizeList(builder: flatbuffers.Builder, listSize: number): flatbuffers.Offset;
}
