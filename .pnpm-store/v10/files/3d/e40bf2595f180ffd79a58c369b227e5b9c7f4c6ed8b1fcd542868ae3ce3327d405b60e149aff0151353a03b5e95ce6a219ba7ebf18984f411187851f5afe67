import * as flatbuffers from 'flatbuffers';
import { Buffer } from './buffer.js';
import { Int } from './int.js';
/**
 * Compressed Sparse Fiber (CSF) sparse tensor index.
 */
export declare class SparseTensorIndexCSF {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): SparseTensorIndexCSF;
    static getRootAsSparseTensorIndexCSF(bb: flatbuffers.ByteBuffer, obj?: SparseTensorIndexCSF): SparseTensorIndexCSF;
    static getSizePrefixedRootAsSparseTensorIndexCSF(bb: flatbuffers.ByteBuffer, obj?: SparseTensorIndexCSF): SparseTensorIndexCSF;
    /**
     * CSF is a generalization of compressed sparse row (CSR) index.
     * See [smith2017knl](http://shaden.io/pub-files/smith2017knl.pdf)
     *
     * CSF index recursively compresses each dimension of a tensor into a set
     * of prefix trees. Each path from a root to leaf forms one tensor
     * non-zero index. CSF is implemented with two arrays of buffers and one
     * arrays of integers.
     *
     * For example, let X be a 2x3x4x5 tensor and let it have the following
     * 8 non-zero values:
     * ```text
     *   X[0, 0, 0, 1] := 1
     *   X[0, 0, 0, 2] := 2
     *   X[0, 1, 0, 0] := 3
     *   X[0, 1, 0, 2] := 4
     *   X[0, 1, 1, 0] := 5
     *   X[1, 1, 1, 0] := 6
     *   X[1, 1, 1, 1] := 7
     *   X[1, 1, 1, 2] := 8
     * ```
     * As a prefix tree this would be represented as:
     * ```text
     *         0          1
     *        / \         |
     *       0   1        1
     *      /   / \       |
     *     0   0   1      1
     *    /|  /|   |    /| |
     *   1 2 0 2   0   0 1 2
     * ```
     * The type of values in indptrBuffers
     */
    indptrType(obj?: Int): Int | null;
    /**
     * indptrBuffers stores the sparsity structure.
     * Each two consecutive dimensions in a tensor correspond to a buffer in
     * indptrBuffers. A pair of consecutive values at `indptrBuffers[dim][i]`
     * and `indptrBuffers[dim][i + 1]` signify a range of nodes in
     * `indicesBuffers[dim + 1]` who are children of `indicesBuffers[dim][i]` node.
     *
     * For example, the indptrBuffers for the above X is:
     * ```text
     *   indptrBuffer(X) = [
     *                       [0, 2, 3],
     *                       [0, 1, 3, 4],
     *                       [0, 2, 4, 5, 8]
     *                     ].
     * ```
     */
    indptrBuffers(index: number, obj?: Buffer): Buffer | null;
    indptrBuffersLength(): number;
    /**
     * The type of values in indicesBuffers
     */
    indicesType(obj?: Int): Int | null;
    /**
     * indicesBuffers stores values of nodes.
     * Each tensor dimension corresponds to a buffer in indicesBuffers.
     * For example, the indicesBuffers for the above X is:
     * ```text
     *   indicesBuffer(X) = [
     *                        [0, 1],
     *                        [0, 1, 1],
     *                        [0, 0, 1, 1],
     *                        [1, 2, 0, 2, 0, 0, 1, 2]
     *                      ].
     * ```
     */
    indicesBuffers(index: number, obj?: Buffer): Buffer | null;
    indicesBuffersLength(): number;
    /**
     * axisOrder stores the sequence in which dimensions were traversed to
     * produce the prefix tree.
     * For example, the axisOrder for the above X is:
     * ```text
     *   axisOrder(X) = [0, 1, 2, 3].
     * ```
     */
    axisOrder(index: number): number | null;
    axisOrderLength(): number;
    axisOrderArray(): Int32Array | null;
    static startSparseTensorIndexCSF(builder: flatbuffers.Builder): void;
    static addIndptrType(builder: flatbuffers.Builder, indptrTypeOffset: flatbuffers.Offset): void;
    static addIndptrBuffers(builder: flatbuffers.Builder, indptrBuffersOffset: flatbuffers.Offset): void;
    static startIndptrBuffersVector(builder: flatbuffers.Builder, numElems: number): void;
    static addIndicesType(builder: flatbuffers.Builder, indicesTypeOffset: flatbuffers.Offset): void;
    static addIndicesBuffers(builder: flatbuffers.Builder, indicesBuffersOffset: flatbuffers.Offset): void;
    static startIndicesBuffersVector(builder: flatbuffers.Builder, numElems: number): void;
    static addAxisOrder(builder: flatbuffers.Builder, axisOrderOffset: flatbuffers.Offset): void;
    static createAxisOrderVector(builder: flatbuffers.Builder, data: number[] | Int32Array): flatbuffers.Offset;
    /**
     * @deprecated This Uint8Array overload will be removed in the future.
     */
    static createAxisOrderVector(builder: flatbuffers.Builder, data: number[] | Uint8Array): flatbuffers.Offset;
    static startAxisOrderVector(builder: flatbuffers.Builder, numElems: number): void;
    static endSparseTensorIndexCSF(builder: flatbuffers.Builder): flatbuffers.Offset;
}
