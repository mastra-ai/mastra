import * as flatbuffers from 'flatbuffers';
import { TimeUnit } from './time-unit.js';
/**
 * Time is either a 32-bit or 64-bit signed integer type representing an
 * elapsed time since midnight, stored in either of four units: seconds,
 * milliseconds, microseconds or nanoseconds.
 *
 * The integer `bitWidth` depends on the `unit` and must be one of the following:
 * * SECOND and MILLISECOND: 32 bits
 * * MICROSECOND and NANOSECOND: 64 bits
 *
 * The allowed values are between 0 (inclusive) and 86400 (=24*60*60) seconds
 * (exclusive), adjusted for the time unit (for example, up to 86400000
 * exclusive for the MILLISECOND unit).
 * This definition doesn't allow for leap seconds. Time values from
 * measurements with leap seconds will need to be corrected when ingesting
 * into Arrow (for example by replacing the value 86400 with 86399).
 */
export declare class Time {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Time;
    static getRootAsTime(bb: flatbuffers.ByteBuffer, obj?: Time): Time;
    static getSizePrefixedRootAsTime(bb: flatbuffers.ByteBuffer, obj?: Time): Time;
    unit(): TimeUnit;
    bitWidth(): number;
    static startTime(builder: flatbuffers.Builder): void;
    static addUnit(builder: flatbuffers.Builder, unit: TimeUnit): void;
    static addBitWidth(builder: flatbuffers.Builder, bitWidth: number): void;
    static endTime(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createTime(builder: flatbuffers.Builder, unit: TimeUnit, bitWidth: number): flatbuffers.Offset;
}
