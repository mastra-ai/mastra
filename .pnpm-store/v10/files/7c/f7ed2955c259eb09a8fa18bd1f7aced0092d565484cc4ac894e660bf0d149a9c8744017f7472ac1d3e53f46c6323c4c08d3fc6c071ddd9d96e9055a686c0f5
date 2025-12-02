import * as flatbuffers from 'flatbuffers';
import { IntervalUnit } from './interval-unit.js';
export declare class Interval {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Interval;
    static getRootAsInterval(bb: flatbuffers.ByteBuffer, obj?: Interval): Interval;
    static getSizePrefixedRootAsInterval(bb: flatbuffers.ByteBuffer, obj?: Interval): Interval;
    unit(): IntervalUnit;
    static startInterval(builder: flatbuffers.Builder): void;
    static addUnit(builder: flatbuffers.Builder, unit: IntervalUnit): void;
    static endInterval(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createInterval(builder: flatbuffers.Builder, unit: IntervalUnit): flatbuffers.Offset;
}
