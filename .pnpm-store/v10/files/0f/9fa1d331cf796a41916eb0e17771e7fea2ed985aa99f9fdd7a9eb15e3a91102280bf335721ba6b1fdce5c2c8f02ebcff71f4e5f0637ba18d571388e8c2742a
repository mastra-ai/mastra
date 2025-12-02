import * as flatbuffers from 'flatbuffers';
import { TimeUnit } from './time-unit.js';
export declare class Duration {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Duration;
    static getRootAsDuration(bb: flatbuffers.ByteBuffer, obj?: Duration): Duration;
    static getSizePrefixedRootAsDuration(bb: flatbuffers.ByteBuffer, obj?: Duration): Duration;
    unit(): TimeUnit;
    static startDuration(builder: flatbuffers.Builder): void;
    static addUnit(builder: flatbuffers.Builder, unit: TimeUnit): void;
    static endDuration(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDuration(builder: flatbuffers.Builder, unit: TimeUnit): flatbuffers.Offset;
}
