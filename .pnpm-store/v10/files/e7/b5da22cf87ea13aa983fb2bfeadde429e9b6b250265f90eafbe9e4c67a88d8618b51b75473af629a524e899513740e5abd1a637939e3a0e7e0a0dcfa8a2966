import * as flatbuffers from 'flatbuffers';
import { Buffer } from './buffer.js';
import { SparseTensorIndex } from './sparse-tensor-index.js';
import { TensorDim } from './tensor-dim.js';
import { Type } from './type.js';
export declare class SparseTensor {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): SparseTensor;
    static getRootAsSparseTensor(bb: flatbuffers.ByteBuffer, obj?: SparseTensor): SparseTensor;
    static getSizePrefixedRootAsSparseTensor(bb: flatbuffers.ByteBuffer, obj?: SparseTensor): SparseTensor;
    typeType(): Type;
    /**
     * The type of data contained in a value cell.
     * Currently only fixed-width value types are supported,
     * no strings or nested types.
     */
    type(obj: any): any | null;
    /**
     * The dimensions of the tensor, optionally named.
     */
    shape(index: number, obj?: TensorDim): TensorDim | null;
    shapeLength(): number;
    /**
     * The number of non-zero values in a sparse tensor.
     */
    nonZeroLength(): bigint;
    sparseIndexType(): SparseTensorIndex;
    /**
     * Sparse tensor index
     */
    sparseIndex(obj: any): any | null;
    /**
     * The location and size of the tensor's data
     */
    data(obj?: Buffer): Buffer | null;
    static startSparseTensor(builder: flatbuffers.Builder): void;
    static addTypeType(builder: flatbuffers.Builder, typeType: Type): void;
    static addType(builder: flatbuffers.Builder, typeOffset: flatbuffers.Offset): void;
    static addShape(builder: flatbuffers.Builder, shapeOffset: flatbuffers.Offset): void;
    static createShapeVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startShapeVector(builder: flatbuffers.Builder, numElems: number): void;
    static addNonZeroLength(builder: flatbuffers.Builder, nonZeroLength: bigint): void;
    static addSparseIndexType(builder: flatbuffers.Builder, sparseIndexType: SparseTensorIndex): void;
    static addSparseIndex(builder: flatbuffers.Builder, sparseIndexOffset: flatbuffers.Offset): void;
    static addData(builder: flatbuffers.Builder, dataOffset: flatbuffers.Offset): void;
    static endSparseTensor(builder: flatbuffers.Builder): flatbuffers.Offset;
    static finishSparseTensorBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
    static finishSizePrefixedSparseTensorBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
}
