import * as flatbuffers from 'flatbuffers';
import { Buffer } from './buffer.js';
import { Int } from './int.js';
/**
 * ----------------------------------------------------------------------
 * EXPERIMENTAL: Data structures for sparse tensors
 * Coordinate (COO) format of sparse tensor index.
 *
 * COO's index list are represented as a NxM matrix,
 * where N is the number of non-zero values,
 * and M is the number of dimensions of a sparse tensor.
 *
 * indicesBuffer stores the location and size of the data of this indices
 * matrix.  The value type and the stride of the indices matrix is
 * specified in indicesType and indicesStrides fields.
 *
 * For example, let X be a 2x3x4x5 tensor, and it has the following
 * 6 non-zero values:
 * ```text
 *   X[0, 1, 2, 0] := 1
 *   X[1, 1, 2, 3] := 2
 *   X[0, 2, 1, 0] := 3
 *   X[0, 1, 3, 0] := 4
 *   X[0, 1, 2, 1] := 5
 *   X[1, 2, 0, 4] := 6
 * ```
 * In COO format, the index matrix of X is the following 4x6 matrix:
 * ```text
 *   [[0, 0, 0, 0, 1, 1],
 *    [1, 1, 1, 2, 1, 2],
 *    [2, 2, 3, 1, 2, 0],
 *    [0, 1, 0, 0, 3, 4]]
 * ```
 * When isCanonical is true, the indices is sorted in lexicographical order
 * (row-major order), and it does not have duplicated entries.  Otherwise,
 * the indices may not be sorted, or may have duplicated entries.
 */
export declare class SparseTensorIndexCOO {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): SparseTensorIndexCOO;
    static getRootAsSparseTensorIndexCOO(bb: flatbuffers.ByteBuffer, obj?: SparseTensorIndexCOO): SparseTensorIndexCOO;
    static getSizePrefixedRootAsSparseTensorIndexCOO(bb: flatbuffers.ByteBuffer, obj?: SparseTensorIndexCOO): SparseTensorIndexCOO;
    /**
     * The type of values in indicesBuffer
     */
    indicesType(obj?: Int): Int | null;
    /**
     * Non-negative byte offsets to advance one value cell along each dimension
     * If omitted, default to row-major order (C-like).
     */
    indicesStrides(index: number): bigint | null;
    indicesStridesLength(): number;
    /**
     * The location and size of the indices matrix's data
     */
    indicesBuffer(obj?: Buffer): Buffer | null;
    /**
     * This flag is true if and only if the indices matrix is sorted in
     * row-major order, and does not have duplicated entries.
     * This sort order is the same as of Tensorflow's SparseTensor,
     * but it is inverse order of SciPy's canonical coo_matrix
     * (SciPy employs column-major order for its coo_matrix).
     */
    isCanonical(): boolean;
    static startSparseTensorIndexCOO(builder: flatbuffers.Builder): void;
    static addIndicesType(builder: flatbuffers.Builder, indicesTypeOffset: flatbuffers.Offset): void;
    static addIndicesStrides(builder: flatbuffers.Builder, indicesStridesOffset: flatbuffers.Offset): void;
    static createIndicesStridesVector(builder: flatbuffers.Builder, data: bigint[]): flatbuffers.Offset;
    static startIndicesStridesVector(builder: flatbuffers.Builder, numElems: number): void;
    static addIndicesBuffer(builder: flatbuffers.Builder, indicesBufferOffset: flatbuffers.Offset): void;
    static addIsCanonical(builder: flatbuffers.Builder, isCanonical: boolean): void;
    static endSparseTensorIndexCOO(builder: flatbuffers.Builder): flatbuffers.Offset;
}
