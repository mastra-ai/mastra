import * as flatbuffers from 'flatbuffers';
/**
 * Contains two child arrays, run_ends and values.
 * The run_ends child array must be a 16/32/64-bit integer array
 * which encodes the indices at which the run with the value in
 * each corresponding index in the values child array ends.
 * Like list/struct types, the value array can be of any type.
 */
export declare class RunEndEncoded {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): RunEndEncoded;
    static getRootAsRunEndEncoded(bb: flatbuffers.ByteBuffer, obj?: RunEndEncoded): RunEndEncoded;
    static getSizePrefixedRootAsRunEndEncoded(bb: flatbuffers.ByteBuffer, obj?: RunEndEncoded): RunEndEncoded;
    static startRunEndEncoded(builder: flatbuffers.Builder): void;
    static endRunEndEncoded(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createRunEndEncoded(builder: flatbuffers.Builder): flatbuffers.Offset;
}
