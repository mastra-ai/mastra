import * as flatbuffers from 'flatbuffers';
/**
 * ----------------------------------------------------------------------
 * Data structures for describing a table row batch (a collection of
 * equal-length Arrow arrays)
 * Metadata about a field at some level of a nested type tree (but not
 * its children).
 *
 * For example, a List<Int16> with values `[[1, 2, 3], null, [4], [5, 6], null]`
 * would have {length: 5, null_count: 2} for its List node, and {length: 6,
 * null_count: 0} for its Int16 node, as separate FieldNode structs
 */
export declare class FieldNode {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): FieldNode;
    /**
     * The number of value slots in the Arrow array at this level of a nested
     * tree
     */
    length(): bigint;
    /**
     * The number of observed nulls. Fields with null_count == 0 may choose not
     * to write their physical validity bitmap out as a materialized buffer,
     * instead setting the length of the bitmap buffer to 0.
     */
    nullCount(): bigint;
    static sizeOf(): number;
    static createFieldNode(builder: flatbuffers.Builder, length: bigint, null_count: bigint): flatbuffers.Offset;
}
