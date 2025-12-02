import * as flatbuffers from 'flatbuffers';
import { DateUnit } from './date-unit.js';
/**
 * Date is either a 32-bit or 64-bit signed integer type representing an
 * elapsed time since UNIX epoch (1970-01-01), stored in either of two units:
 *
 * * Milliseconds (64 bits) indicating UNIX time elapsed since the epoch (no
 *   leap seconds), where the values are evenly divisible by 86400000
 * * Days (32 bits) since the UNIX epoch
 */
export declare class Date {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Date;
    static getRootAsDate(bb: flatbuffers.ByteBuffer, obj?: Date): Date;
    static getSizePrefixedRootAsDate(bb: flatbuffers.ByteBuffer, obj?: Date): Date;
    unit(): DateUnit;
    static startDate(builder: flatbuffers.Builder): void;
    static addUnit(builder: flatbuffers.Builder, unit: DateUnit): void;
    static endDate(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDate(builder: flatbuffers.Builder, unit: DateUnit): flatbuffers.Offset;
}
