import * as flatbuffers from 'flatbuffers';
import { Buffer } from './buffer.js';
import { Int } from './int.js';
import { SparseMatrixCompressedAxis } from './sparse-matrix-compressed-axis.js';
/**
 * Compressed Sparse format, that is matrix-specific.
 */
export declare class SparseMatrixIndexCSX {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): SparseMatrixIndexCSX;
    static getRootAsSparseMatrixIndexCSX(bb: flatbuffers.ByteBuffer, obj?: SparseMatrixIndexCSX): SparseMatrixIndexCSX;
    static getSizePrefixedRootAsSparseMatrixIndexCSX(bb: flatbuffers.ByteBuffer, obj?: SparseMatrixIndexCSX): SparseMatrixIndexCSX;
    /**
     * Which axis, row or column, is compressed
     */
    compressedAxis(): SparseMatrixCompressedAxis;
    /**
     * The type of values in indptrBuffer
     */
    indptrType(obj?: Int): Int | null;
    /**
     * indptrBuffer stores the location and size of indptr array that
     * represents the range of the rows.
     * The i-th row spans from `indptr[i]` to `indptr[i+1]` in the data.
     * The length of this array is 1 + (the number of rows), and the type
     * of index value is long.
     *
     * For example, let X be the following 6x4 matrix:
     * ```text
     *   X := [[0, 1, 2, 0],
     *         [0, 0, 3, 0],
     *         [0, 4, 0, 5],
     *         [0, 0, 0, 0],
     *         [6, 0, 7, 8],
     *         [0, 9, 0, 0]].
     * ```
     * The array of non-zero values in X is:
     * ```text
     *   values(X) = [1, 2, 3, 4, 5, 6, 7, 8, 9].
     * ```
     * And the indptr of X is:
     * ```text
     *   indptr(X) = [0, 2, 3, 5, 5, 8, 10].
     * ```
     */
    indptrBuffer(obj?: Buffer): Buffer | null;
    /**
     * The type of values in indicesBuffer
     */
    indicesType(obj?: Int): Int | null;
    /**
     * indicesBuffer stores the location and size of the array that
     * contains the column indices of the corresponding non-zero values.
     * The type of index value is long.
     *
     * For example, the indices of the above X is:
     * ```text
     *   indices(X) = [1, 2, 2, 1, 3, 0, 2, 3, 1].
     * ```
     * Note that the indices are sorted in lexicographical order for each row.
     */
    indicesBuffer(obj?: Buffer): Buffer | null;
    static startSparseMatrixIndexCSX(builder: flatbuffers.Builder): void;
    static addCompressedAxis(builder: flatbuffers.Builder, compressedAxis: SparseMatrixCompressedAxis): void;
    static addIndptrType(builder: flatbuffers.Builder, indptrTypeOffset: flatbuffers.Offset): void;
    static addIndptrBuffer(builder: flatbuffers.Builder, indptrBufferOffset: flatbuffers.Offset): void;
    static addIndicesType(builder: flatbuffers.Builder, indicesTypeOffset: flatbuffers.Offset): void;
    static addIndicesBuffer(builder: flatbuffers.Builder, indicesBufferOffset: flatbuffers.Offset): void;
    static endSparseMatrixIndexCSX(builder: flatbuffers.Builder): flatbuffers.Offset;
}
