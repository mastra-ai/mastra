import * as flatbuffers from 'flatbuffers';
/**
 * ----------------------------------------------------------------------
 * Data structures for dense tensors
 * Shape data for a single axis in a tensor
 */
export declare class TensorDim {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): TensorDim;
    static getRootAsTensorDim(bb: flatbuffers.ByteBuffer, obj?: TensorDim): TensorDim;
    static getSizePrefixedRootAsTensorDim(bb: flatbuffers.ByteBuffer, obj?: TensorDim): TensorDim;
    /**
     * Length of dimension
     */
    size(): bigint;
    /**
     * Name of the dimension, optional
     */
    name(): string | null;
    name(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    static startTensorDim(builder: flatbuffers.Builder): void;
    static addSize(builder: flatbuffers.Builder, size: bigint): void;
    static addName(builder: flatbuffers.Builder, nameOffset: flatbuffers.Offset): void;
    static endTensorDim(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createTensorDim(builder: flatbuffers.Builder, size: bigint, nameOffset: flatbuffers.Offset): flatbuffers.Offset;
}
