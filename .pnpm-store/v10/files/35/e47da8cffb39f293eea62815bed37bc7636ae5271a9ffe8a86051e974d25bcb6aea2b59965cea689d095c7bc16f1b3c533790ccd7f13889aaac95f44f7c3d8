import * as flatbuffers from 'flatbuffers';
import { KeyValue } from './key-value.js';
import { MessageHeader } from './message-header.js';
import { MetadataVersion } from './metadata-version.js';
export declare class Message {
    bb: flatbuffers.ByteBuffer | null;
    bb_pos: number;
    __init(i: number, bb: flatbuffers.ByteBuffer): Message;
    static getRootAsMessage(bb: flatbuffers.ByteBuffer, obj?: Message): Message;
    static getSizePrefixedRootAsMessage(bb: flatbuffers.ByteBuffer, obj?: Message): Message;
    version(): MetadataVersion;
    headerType(): MessageHeader;
    header(obj: any): any | null;
    bodyLength(): bigint;
    customMetadata(index: number, obj?: KeyValue): KeyValue | null;
    customMetadataLength(): number;
    static startMessage(builder: flatbuffers.Builder): void;
    static addVersion(builder: flatbuffers.Builder, version: MetadataVersion): void;
    static addHeaderType(builder: flatbuffers.Builder, headerType: MessageHeader): void;
    static addHeader(builder: flatbuffers.Builder, headerOffset: flatbuffers.Offset): void;
    static addBodyLength(builder: flatbuffers.Builder, bodyLength: bigint): void;
    static addCustomMetadata(builder: flatbuffers.Builder, customMetadataOffset: flatbuffers.Offset): void;
    static createCustomMetadataVector(builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset;
    static startCustomMetadataVector(builder: flatbuffers.Builder, numElems: number): void;
    static endMessage(builder: flatbuffers.Builder): flatbuffers.Offset;
    static finishMessageBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
    static finishSizePrefixedMessageBuffer(builder: flatbuffers.Builder, offset: flatbuffers.Offset): void;
    static createMessage(builder: flatbuffers.Builder, version: MetadataVersion, headerType: MessageHeader, headerOffset: flatbuffers.Offset, bodyLength: bigint, customMetadataOffset: flatbuffers.Offset): flatbuffers.Offset;
}
