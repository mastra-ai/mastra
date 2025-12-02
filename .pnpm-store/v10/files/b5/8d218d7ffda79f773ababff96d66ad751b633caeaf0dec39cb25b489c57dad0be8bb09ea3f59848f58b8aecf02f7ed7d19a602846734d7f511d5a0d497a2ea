import * as flatbuffers from 'flatbuffers';
/**
 * ----------------------------------------------------------------------
 * user defined key value pairs to add custom metadata to arrow
 * key namespacing is the responsibility of the user
 */
export declare class KeyValue {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): KeyValue;
    static getRootAsKeyValue(bb: flatbuffers.ByteBuffer, obj?: KeyValue): KeyValue;
    static getSizePrefixedRootAsKeyValue(bb: flatbuffers.ByteBuffer, obj?: KeyValue): KeyValue;
    key(): string | null;
    key(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    value(): string | null;
    value(optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
    static startKeyValue(builder: flatbuffers.Builder): void;
    static addKey(builder: flatbuffers.Builder, keyOffset: flatbuffers.Offset): void;
    static addValue(builder: flatbuffers.Builder, valueOffset: flatbuffers.Offset): void;
    static endKeyValue(builder: flatbuffers.Builder): flatbuffers.Offset;
    static createKeyValue(builder: flatbuffers.Builder, keyOffset: flatbuffers.Offset, valueOffset: flatbuffers.Offset): flatbuffers.Offset;
}
