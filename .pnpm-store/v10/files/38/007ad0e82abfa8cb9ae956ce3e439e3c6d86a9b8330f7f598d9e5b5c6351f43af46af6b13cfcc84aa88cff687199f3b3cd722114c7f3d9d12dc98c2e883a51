// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { FileHandle } from './interfaces.js';
import { ByteStream, AsyncByteStream } from './stream.js';
import { ArrayBufferViewInput, toUint8Array } from '../util/buffer.js';

/** @ignore */
export class RandomAccessFile extends ByteStream {
    public size: number;
    public position = 0;
    protected buffer: Uint8Array | null;
    constructor(buffer: ArrayBufferViewInput, byteLength?: number) {
        super();
        this.buffer = toUint8Array(buffer);
        this.size = byteLength === undefined ? this.buffer!.byteLength : byteLength;
    }
    public readInt32(position: number) {
        const { buffer, byteOffset } = this.readAt(position, 4);
        return new DataView(buffer, byteOffset).getInt32(0, true);
    }
    public seek(position: number) {
        this.position = Math.min(position, this.size);
        return position < this.size;
    }
    public read(nBytes?: number | null) {
        const { buffer, size, position } = this;
        if (buffer && position < size) {
            if (typeof nBytes !== 'number') { nBytes = Number.POSITIVE_INFINITY; }
            this.position = Math.min(size,
                position + Math.min(size - position, nBytes));
            return buffer.subarray(position, this.position);
        }
        return null;
    }
    public readAt(position: number, nBytes: number) {
        const buf = this.buffer;
        const end = Math.min(this.size, position + nBytes);
        return buf ? buf.subarray(position, end) : new Uint8Array(nBytes);
    }
    public close() { this.buffer && (this.buffer = null); }
    public throw(value?: any) { this.close(); return { done: true, value }; }
    public return(value?: any) { this.close(); return { done: true, value }; }
}

/** @ignore */
export class AsyncRandomAccessFile extends AsyncByteStream {
    declare public size: number;
    public position = 0;
    public _pending?: Promise<void>;
    protected _handle: FileHandle | null;
    constructor(file: FileHandle, byteLength?: number) {
        super();
        this._handle = file;
        if (typeof byteLength === 'number') {
            this.size = byteLength;
        } else {
            this._pending = (async () => {
                this.size = (await file.stat()).size;
                delete this._pending;
            })();
        }
    }
    public async readInt32(position: number) {
        const { buffer, byteOffset } = await this.readAt(position, 4);
        return new DataView(buffer, byteOffset).getInt32(0, true);
    }
    public async seek(position: number) {
        this._pending && await this._pending;
        this.position = Math.min(position, this.size);
        return position < this.size;
    }
    public async read(nBytes?: number | null) {
        this._pending && await this._pending;
        const { _handle: file, size, position } = this;
        if (file && position < size) {
            if (typeof nBytes !== 'number') { nBytes = Number.POSITIVE_INFINITY; }
            let pos = position, offset = 0, bytesRead = 0;
            const end = Math.min(size, pos + Math.min(size - pos, nBytes));
            const buffer = new Uint8Array(Math.max(0, (this.position = end) - pos));
            while ((pos += bytesRead) < end && (offset += bytesRead) < buffer.byteLength) {
                ({ bytesRead } = await file.read(buffer, offset, buffer.byteLength - offset, pos));
            }
            return buffer;
        }
        return null;
    }
    public async readAt(position: number, nBytes: number) {
        this._pending && await this._pending;
        const { _handle: file, size } = this;
        if (file && (position + nBytes) < size) {
            const end = Math.min(size, position + nBytes);
            const buffer = new Uint8Array(end - position);
            return (await file.read(buffer, 0, nBytes, position)).buffer;
        }
        return new Uint8Array(nBytes);
    }
    public async close() { const f = this._handle; this._handle = null; f && await f.close(); }
    public async throw(value?: any) { await this.close(); return { done: true, value }; }
    public async return(value?: any) { await this.close(); return { done: true, value }; }
}
