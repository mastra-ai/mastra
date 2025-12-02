import * as flatbuffers from 'flatbuffers';
import { UnionMode } from './union-mode.js';
/**
 * A union is a complex type with children in Field
 * By default ids in the type vector refer to the offsets in the children
 * optionally typeIds provides an indirection between the child offset and the type id
 * for each child `typeIds[offset]` is the id used in the type vector
 */
export declare class Union {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Union;
    static getRootAsUnion(bb: flatbuffers.ByteBuffer, obj?: Union): Union;
    static getSizePrefixedRootAsUnion(bb: flatbuffers.ByteBuffer, obj?: Union): Union;
    mode(): UnionMode;
    typeIds(index: number): number | null;
    typeIdsLength(): number;
    typeIdsArray(): Int32Array | null;
    static startUnion(builder: flatbuffers.Builder): void;
    static addMode(builder: flatbuffers.Builder, mode: UnionMode): void;
    static addTypeIds(builder: flatbuffers.Builder, typeIdsOffset: flatbuffers.Offset): void;
    static createTypeIdsVector(builder: flatbuffers.Builder, data: number[] | Int32Array): flatbuffers.Offset;
    /**
     * @deprecated This Uint8Array overload will be removed in the future.
     */
    static createTypeIdsVector(builder: flatbuffers.Builder, data: number[] | Uint8Array): flatbuffers.Offset;
    static startTypeIdsVector(builder: flatbuffers.Builder, numElems: number): void;
    static endUnion(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createUnion(builder: flatbuffers.Builder, mode: UnionMode, typeIdsOffset: flatbuffers.Offset): flatbuffers.Offset;
}
