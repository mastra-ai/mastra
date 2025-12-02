import * as flatbuffers from 'flatbuffers';
import { Schema as _Schema } from '../../fb/schema.js';
import { RecordBatch as _RecordBatch } from '../../fb/record-batch.js';
import { DictionaryBatch as _DictionaryBatch } from '../../fb/dictionary-batch.js';
import { Buffer as _Buffer } from '../../fb/buffer.js';
import { Field as _Field } from '../../fb/field.js';
import { FieldNode as _FieldNode } from '../../fb/field-node.js';
import { Schema, Field } from '../../schema.js';
import { ArrayBufferViewInput } from '../../util/buffer.js';
import { MessageHeader, MetadataVersion } from '../../enum.js';
import { fieldFromJSON, schemaFromJSON, recordBatchFromJSON, dictionaryBatchFromJSON } from './json.js';
import Builder = flatbuffers.Builder;
import { DataType } from '../../type.js';
/**
 * @ignore
 * @private
 **/
export declare class Message<T extends MessageHeader = any> {
    /** @nocollapse */
    static fromJSON<T extends MessageHeader>(msg: any, headerType: T): Message<T>;
    /** @nocollapse */
    static decode(buf: ArrayBufferViewInput): Message<MessageHeader>;
    /** @nocollapse */
    static encode<T extends MessageHeader>(message: Message<T>): Uint8Array;
    /** @nocollapse */
    static from(header: Schema | RecordBatch | DictionaryBatch, bodyLength?: number): Message<MessageHeader.Schema> | Message<MessageHeader.RecordBatch> | Message<MessageHeader.DictionaryBatch>;
    body: Uint8Array;
    protected _headerType: T;
    protected _bodyLength: number;
    protected _version: MetadataVersion;
    get type(): T;
    get version(): MetadataVersion;
    get headerType(): T;
    get bodyLength(): number;
    protected _createHeader: MessageHeaderDecoder;
    header(): T extends MessageHeader.Schema ? Schema<any> : T extends MessageHeader.RecordBatch ? RecordBatch : T extends MessageHeader.DictionaryBatch ? DictionaryBatch : never;
    isSchema(): this is Message<MessageHeader.Schema>;
    isRecordBatch(): this is Message<MessageHeader.RecordBatch>;
    isDictionaryBatch(): this is Message<MessageHeader.DictionaryBatch>;
    constructor(bodyLength: bigint | number, version: MetadataVersion, headerType: T, header?: any);
}
/**
 * @ignore
 * @private
 **/
export declare class RecordBatch {
    protected _length: number;
    protected _nodes: FieldNode[];
    protected _buffers: BufferRegion[];
    get nodes(): FieldNode[];
    get length(): number;
    get buffers(): BufferRegion[];
    constructor(length: bigint | number, nodes: FieldNode[], buffers: BufferRegion[]);
}
/**
 * @ignore
 * @private
 **/
export declare class DictionaryBatch {
    protected _id: number;
    protected _isDelta: boolean;
    protected _data: RecordBatch;
    get id(): number;
    get data(): RecordBatch;
    get isDelta(): boolean;
    get length(): number;
    get nodes(): FieldNode[];
    get buffers(): BufferRegion[];
    constructor(data: RecordBatch, id: bigint | number, isDelta?: boolean);
}
/**
 * @ignore
 * @private
 **/
export declare class BufferRegion {
    offset: number;
    length: number;
    constructor(offset: bigint | number, length: bigint | number);
}
/**
 * @ignore
 * @private
 **/
export declare class FieldNode {
    length: number;
    nullCount: number;
    constructor(length: bigint | number, nullCount: bigint | number);
}
declare module '../../schema' {
    namespace Field {
        export { encodeField as encode };
        export { decodeField as decode };
        export { fieldFromJSON as fromJSON };
    }
    namespace Schema {
        export { encodeSchema as encode };
        export { decodeSchema as decode };
        export { schemaFromJSON as fromJSON };
    }
}
declare module './message' {
    namespace RecordBatch {
        export { encodeRecordBatch as encode };
        export { decodeRecordBatch as decode };
        export { recordBatchFromJSON as fromJSON };
    }
    namespace DictionaryBatch {
        export { encodeDictionaryBatch as encode };
        export { decodeDictionaryBatch as decode };
        export { dictionaryBatchFromJSON as fromJSON };
    }
    namespace FieldNode {
        export { encodeFieldNode as encode };
        export { decodeFieldNode as decode };
    }
    namespace BufferRegion {
        export { encodeBufferRegion as encode };
        export { decodeBufferRegion as decode };
    }
}
/** @ignore */
declare function decodeSchema(_schema: _Schema, dictionaries?: Map<number, DataType>, version?: MetadataVersion): Schema<any>;
/** @ignore */
declare function decodeRecordBatch(batch: _RecordBatch, version?: MetadataVersion): RecordBatch;
/** @ignore */
declare function decodeDictionaryBatch(batch: _DictionaryBatch, version?: MetadataVersion): DictionaryBatch;
/** @ignore */
declare function decodeBufferRegion(b: _Buffer): BufferRegion;
/** @ignore */
declare function decodeFieldNode(f: _FieldNode): FieldNode;
/** @ignore */
declare function decodeField(f: _Field, dictionaries?: Map<number, DataType>): Field<any>;
/** @ignore */
declare function encodeSchema(b: Builder, schema: Schema): number;
/** @ignore */
declare function encodeField(b: Builder, field: Field): number;
/** @ignore */
declare function encodeRecordBatch(b: Builder, recordBatch: RecordBatch): number;
/** @ignore */
declare function encodeDictionaryBatch(b: Builder, dictionaryBatch: DictionaryBatch): number;
/** @ignore */
declare function encodeFieldNode(b: Builder, node: FieldNode): number;
/** @ignore */
declare function encodeBufferRegion(b: Builder, node: BufferRegion): number;
/** @ignore */
type MessageHeaderDecoder = <T extends MessageHeader>() => T extends MessageHeader.Schema ? Schema : T extends MessageHeader.RecordBatch ? RecordBatch : T extends MessageHeader.DictionaryBatch ? DictionaryBatch : never;
export {};
