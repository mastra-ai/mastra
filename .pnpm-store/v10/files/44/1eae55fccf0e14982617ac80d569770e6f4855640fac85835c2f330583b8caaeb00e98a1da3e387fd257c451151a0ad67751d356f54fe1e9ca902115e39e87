import * as flatbuffers from 'flatbuffers';
import { Buffer } from './buffer.js';
import { TensorDim } from './tensor-dim.js';
import { Type } from './type.js';
export declare class Tensor {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Tensor;
    static getRootAsTensor(bb: flatbuffers.ByteBuffer, obj?: Tensor): Tensor;
    static getSizePrefixedRootAsTensor(bb: flatbuffers.ByteBuffer, obj?: Tensor): Tensor;
    typeType(): Type;
    /**
     * The type of data contained in a value cell. Currently only fixed-width
     * value types are supported, no strings or nested types
     */
    type(obj: any): any | null;
    /**
     * The dimensions of the tensor, optionally named
     */
    shape(index: number, obj?: TensorDim): TensorDim | null;
    shapeLength(): number;
    /**
     * Non-negative byte offsets to advance one value cell along each dimension
     * If omitted, default to row-major order (C-like).
     */
    strides(index: number): bigint | null;
    stridesLength(): number;
    /**
     * The location and size of the tensor's data
     */
    data(obj?: Buffer): Buffer | null;
    static startTensor(builder: flatbuffers.Builder): void;
    static addTypeType(builder: flatbuffers.Builder, typeType: Type): void;
    static addType(builder: flatbuffers.Builder, typeOffset: flatbuffers.Offset): void;
    static addShape(builder: flatbuffers.Builder, shapeOffset: flatbuffers.Offset): void;
    static createShapeVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startShapeVector(builder: flatbuffers.Builder, numElems: number): void;
    static addStrides(builder: flatbuffers.Builder, stridesOffset: flatbuffers.Offset): void;
    static createStridesVector(builder: flatbuffers.Builder, data: bigint[]): flatbuffers.Offset;
    static startStridesVector(builder: flatbuffers.Builder, numElems: number): void;
    static addData(builder: flatbuffers.Builder, dataOffset: flatbuffers.Offset): void;
    static endTensor(builder: flatbuffers.Builder): flatbuffers.Offset;
    static finishTensorBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
    static finishSizePrefixedTensorBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
}
