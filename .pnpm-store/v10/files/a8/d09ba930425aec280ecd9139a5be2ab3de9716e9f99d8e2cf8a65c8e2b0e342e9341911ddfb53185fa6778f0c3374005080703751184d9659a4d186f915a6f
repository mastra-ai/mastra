import * as flatbuffers from 'flatbuffers';
/**
 * Exact decimal value represented as an integer value in two's
 * complement. Currently only 128-bit (16-byte) and 256-bit (32-byte) integers
 * are used. The representation uses the endianness indicated
 * in the Schema.
 */
export declare class Decimal {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Decimal;
    static getRootAsDecimal(bb: flatbuffers.ByteBuffer, obj?: Decimal): Decimal;
    static getSizePrefixedRootAsDecimal(bb: flatbuffers.ByteBuffer, obj?: Decimal): Decimal;
    /**
     * Total number of decimal digits
     */
    precision(): number;
    /**
     * Number of digits after the decimal point "."
     */
    scale(): number;
    /**
     * Number of bits per value. The only accepted widths are 128 and 256.
     * We use bitWidth for consistency with Int::bitWidth.
     */
    bitWidth(): number;
    static startDecimal(builder: flatbuffers.Builder): void;
    static addPrecision(builder: flatbuffers.Builder, precision: number): void;
    static addScale(builder: flatbuffers.Builder, scale: number): void;
    static addBitWidth(builder: flatbuffers.Builder, bitWidth: number): void;
    static endDecimal(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createDecimal(builder: flatbuffers.Builder, precision: number, scale: number, bitWidth: number): flatbuffers.Offset;
}
