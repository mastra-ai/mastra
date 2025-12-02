import * as flatbuffers from 'flatbuffers';
import { Precision } from './precision.js';
export declare class FloatingPoint {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): FloatingPoint;
    static getRootAsFloatingPoint(bb: flatbuffers.ByteBuffer, obj?: FloatingPoint): FloatingPoint;
    static getSizePrefixedRootAsFloatingPoint(bb: flatbuffers.ByteBuffer, obj?: FloatingPoint): FloatingPoint;
    precision(): Precision;
    static startFloatingPoint(builder: flatbuffers.Builder): void;
    static addPrecision(builder: flatbuffers.Builder, precision: Precision): void;
    static endFloatingPoint(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createFloatingPoint(builder: flatbuffers.Builder, precision: Precision): flatbuffers.Offset;
}
