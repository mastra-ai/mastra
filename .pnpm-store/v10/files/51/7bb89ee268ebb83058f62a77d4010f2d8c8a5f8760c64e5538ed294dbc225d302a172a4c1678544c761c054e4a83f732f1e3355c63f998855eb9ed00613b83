import * as flatbuffers from 'flatbuffers';
import { BodyCompressionMethod } from './body-compression-method.js';
import { CompressionType } from './compression-type.js';
/**
 * Optional compression for the memory buffers constituting IPC message
 * bodies. Intended for use with RecordBatch but could be used for other
 * message types
 */
export declare class BodyCompression {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): BodyCompression;
    static getRootAsBodyCompression(bb: flatbuffers.ByteBuffer, obj?: BodyCompression): BodyCompression;
    static getSizePrefixedRootAsBodyCompression(bb: flatbuffers.ByteBuffer, obj?: BodyCompression): BodyCompression;
    /**
     * Compressor library.
     * For LZ4_FRAME, each compressed buffer must consist of a single frame.
     */
    codec(): CompressionType;
    /**
     * Indicates the way the record batch body was compressed
     */
    method(): BodyCompressionMethod;
    static startBodyCompression(builder: flatbuffers.Builder): void;
    static addCodec(builder: flatbuffers.Builder, codec: CompressionType): void;
    static addMethod(builder: flatbuffers.Builder, method: BodyCompressionMethod): void;
    static endBodyCompression(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createBodyCompression(builder: flatbuffers.Builder, codec: CompressionType, method: BodyCompressionMethod): flatbuffers.Offset;
}
