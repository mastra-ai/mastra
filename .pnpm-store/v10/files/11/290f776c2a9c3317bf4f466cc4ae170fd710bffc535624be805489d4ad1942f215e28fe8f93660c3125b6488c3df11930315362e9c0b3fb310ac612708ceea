/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type char from "./chars";
export declare const utf8Encoder: TextEncoder;
export declare const utf8Decoder: TextDecoder;
declare let decodeB64: (_: string) => Uint8Array;
declare let encodeB64: (_: Uint8Array) => string;
export { decodeB64, encodeB64 };
export declare class BufferError extends Error {
}
export declare class WriteBuffer {
    private _rawBuffer;
    buffer: DataView;
    private size;
    private pos;
    constructor();
    get position(): number;
    reset(): void;
    private ensureAlloced;
    private __realloc;
    writeChar(ch: char): this;
    writeString(s: string): this;
    writeBytes(buf: Uint8Array): this;
    writeInt16(i: number): this;
    writeInt32(i: number): this;
    writeFloat32(i: number): this;
    writeFloat64(i: number): this;
    writeUInt8(i: number): this;
    writeUInt16(i: number): this;
    writeUInt32(i: number): this;
    writeInt64(i: number): this;
    writeBigInt64(i: bigint): this;
    writeBuffer(buf: Uint8Array): this;
    writeDeferredSize(): () => void;
    unwrap(): Uint8Array;
}
export declare class WriteMessageBuffer {
    private buffer;
    private messagePos;
    constructor();
    reset(): this;
    beginMessage(mtype: char): this;
    endMessage(): this;
    writeChar(ch: char): this;
    writeString(s: string): this;
    writeBytes(val: Uint8Array): this;
    writeInt16(i: number): this;
    writeInt32(i: number): this;
    writeUInt16(i: number): this;
    writeUInt32(i: number): this;
    writeBigInt64(i: bigint): this;
    writeFlags(h: number, l: number): this;
    writeBuffer(buf: Uint8Array): this;
    writeSync(): this;
    writeFlush(): this;
    unwrap(): Uint8Array;
}
export declare function uuidToBuffer(uuid: string): Uint8Array;
export declare class ReadMessageBuffer {
    private bufs;
    private len;
    private buf0;
    private pos0;
    private len0;
    private curMessageType;
    private curMessageLen;
    curMessageLenUnread: number;
    private curMessageReady;
    constructor();
    get length(): number;
    feed(buf: Uint8Array): void;
    private feedEnqueue;
    private ensureFirstBuf;
    private checkOverread;
    private __nextBuf;
    private discardBuffer;
    private _finishMessage;
    private __readBufferCopy;
    private _readBuffer;
    readBuffer(size: number): Uint8Array;
    readUUID(): string;
    readChar(): char;
    readInt16(): number;
    readInt32(): number;
    readUInt16(): number;
    readUInt32(): number;
    readBigInt64(): bigint;
    readString(): string;
    readLenPrefixedBuffer(): Uint8Array;
    takeMessage(): boolean;
    getMessageType(): char;
    takeMessageType(mtype: char): boolean;
    putMessage(): void;
    discardMessage(): void;
    consumeMessage(): Uint8Array;
    consumeMessageInto(frb: ReadBuffer): void;
    finishMessage(): void;
}
export declare class ReadBuffer {
    private _rawBuffer;
    private buffer;
    private pos;
    private len;
    constructor(buf: Uint8Array);
    get position(): number;
    get length(): number;
    finish(message?: string): void;
    discard(size: number): void;
    readUInt8(): number;
    readUInt16(): number;
    readInt8(): number;
    readInt16(): number;
    readInt32(): number;
    readFloat32(): number;
    readFloat64(le?: boolean): number;
    readUInt32(le?: boolean): number;
    private reportInt64Overflow;
    readInt64(): number;
    readBigInt64(): bigint;
    readBoolean(): boolean;
    readBuffer(size: number): Uint8Array;
    readUUIDBytes(): Uint8Array;
    readUUID(dash?: string): string;
    readString(): string;
    consumeAsString(): string;
    consumeAsBuffer(): Uint8Array;
    sliceInto(frb: ReadBuffer, size: number): void;
    static init(frb: ReadBuffer, buffer: Uint8Array): void;
    static alloc(): ReadBuffer;
}
