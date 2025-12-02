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
import { __awaiter } from "tslib";
import { ByteStream, AsyncByteStream } from './stream.mjs';
import { toUint8Array } from '../util/buffer.mjs';
/** @ignore */
export class RandomAccessFile extends ByteStream {
    constructor(buffer, byteLength) {
        super();
        this.position = 0;
        this.buffer = toUint8Array(buffer);
        this.size = byteLength === undefined ? this.buffer.byteLength : byteLength;
    }
    readInt32(position) {
        const { buffer, byteOffset } = this.readAt(position, 4);
        return new DataView(buffer, byteOffset).getInt32(0, true);
    }
    seek(position) {
        this.position = Math.min(position, this.size);
        return position < this.size;
    }
    read(nBytes) {
        const { buffer, size, position } = this;
        if (buffer && position < size) {
            if (typeof nBytes !== 'number') {
                nBytes = Number.POSITIVE_INFINITY;
            }
            this.position = Math.min(size, position + Math.min(size - position, nBytes));
            return buffer.subarray(position, this.position);
        }
        return null;
    }
    readAt(position, nBytes) {
        const buf = this.buffer;
        const end = Math.min(this.size, position + nBytes);
        return buf ? buf.subarray(position, end) : new Uint8Array(nBytes);
    }
    close() { this.buffer && (this.buffer = null); }
    throw(value) { this.close(); return { done: true, value }; }
    return(value) { this.close(); return { done: true, value }; }
}
/** @ignore */
export class AsyncRandomAccessFile extends AsyncByteStream {
    constructor(file, byteLength) {
        super();
        this.position = 0;
        this._handle = file;
        if (typeof byteLength === 'number') {
            this.size = byteLength;
        }
        else {
            this._pending = (() => __awaiter(this, void 0, void 0, function* () {
                this.size = (yield file.stat()).size;
                delete this._pending;
            }))();
        }
    }
    readInt32(position) {
        return __awaiter(this, void 0, void 0, function* () {
            const { buffer, byteOffset } = yield this.readAt(position, 4);
            return new DataView(buffer, byteOffset).getInt32(0, true);
        });
    }
    seek(position) {
        return __awaiter(this, void 0, void 0, function* () {
            this._pending && (yield this._pending);
            this.position = Math.min(position, this.size);
            return position < this.size;
        });
    }
    read(nBytes) {
        return __awaiter(this, void 0, void 0, function* () {
            this._pending && (yield this._pending);
            const { _handle: file, size, position } = this;
            if (file && position < size) {
                if (typeof nBytes !== 'number') {
                    nBytes = Number.POSITIVE_INFINITY;
                }
                let pos = position, offset = 0, bytesRead = 0;
                const end = Math.min(size, pos + Math.min(size - pos, nBytes));
                const buffer = new Uint8Array(Math.max(0, (this.position = end) - pos));
                while ((pos += bytesRead) < end && (offset += bytesRead) < buffer.byteLength) {
                    ({ bytesRead } = yield file.read(buffer, offset, buffer.byteLength - offset, pos));
                }
                return buffer;
            }
            return null;
        });
    }
    readAt(position, nBytes) {
        return __awaiter(this, void 0, void 0, function* () {
            this._pending && (yield this._pending);
            const { _handle: file, size } = this;
            if (file && (position + nBytes) < size) {
                const end = Math.min(size, position + nBytes);
                const buffer = new Uint8Array(end - position);
                return (yield file.read(buffer, 0, nBytes, position)).buffer;
            }
            return new Uint8Array(nBytes);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () { const f = this._handle; this._handle = null; f && (yield f.close()); });
    }
    throw(value) {
        return __awaiter(this, void 0, void 0, function* () { yield this.close(); return { done: true, value }; });
    }
    return(value) {
        return __awaiter(this, void 0, void 0, function* () { yield this.close(); return { done: true, value }; });
    }
}

//# sourceMappingURL=file.mjs.map
