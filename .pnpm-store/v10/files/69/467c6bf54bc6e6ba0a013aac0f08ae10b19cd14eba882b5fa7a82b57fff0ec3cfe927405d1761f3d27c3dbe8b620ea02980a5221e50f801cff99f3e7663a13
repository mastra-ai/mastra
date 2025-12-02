"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfsFsFileHandle = void 0;
const events_1 = require("events");
const stream_1 = require("stream");
const builder_1 = require("../builder");
class NfsFsFileHandle extends events_1.EventEmitter {
    constructor(fd, path, client, stateid, openOwner) {
        super();
        this.path = path;
        this.client = client;
        this.stateid = stateid;
        this.openOwner = openOwner;
        this.closed = false;
        this.fd = fd;
    }
    getAsyncId() {
        return this.fd;
    }
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        await this.client.closeStateid(this.openOwner, this.stateid);
        this.emit('close');
    }
    async stat(options) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.stat(this.path, options);
    }
    async appendFile(data, options) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.appendFile(this.path, data, options);
    }
    async chmod(mode) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.chmod(this.path, mode);
    }
    async chown(uid, gid) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.chown(this.path, uid, gid);
    }
    async datasync() {
        if (this.closed)
            throw new Error('File handle is closed');
    }
    async read(buffer, offset, length, position) {
        if (this.closed)
            throw new Error('File handle is closed');
        const readPos = position !== null && position !== undefined ? BigInt(position) : BigInt(0);
        const readOps = [builder_1.nfs.READ(readPos, length, this.stateid)];
        const response = await this.client.fs.compound(readOps);
        if (response.status !== 0) {
            throw new Error(`Failed to read file: ${response.status}`);
        }
        const readRes = response.resarray[0];
        if (readRes.status !== 0 || !readRes.resok) {
            throw new Error(`Failed to read file: ${readRes.status}`);
        }
        const data = readRes.resok.data;
        const bytesToCopy = Math.min(data.length, length);
        for (let i = 0; i < bytesToCopy; i++) {
            buffer[offset + i] = data[i];
        }
        return { bytesRead: bytesToCopy, buffer };
    }
    async readFile(options) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.readFile(this.path, options);
    }
    async truncate(len) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.truncate(this.path, len);
    }
    async utimes(atime, mtime) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.utimes(this.path, atime, mtime);
    }
    async write(buffer, offset, length, position) {
        if (this.closed)
            throw new Error('File handle is closed');
        const actualOffset = offset ?? 0;
        const actualLength = length ?? buffer.byteLength - actualOffset;
        const writePos = position !== null && position !== undefined ? BigInt(position) : BigInt(0);
        let data;
        if (buffer instanceof Uint8Array) {
            data = Uint8Array.prototype.slice.call(buffer, actualOffset, actualOffset + actualLength);
        }
        else if (Buffer.isBuffer(buffer)) {
            data = new Uint8Array(buffer.buffer, buffer.byteOffset + actualOffset, actualLength);
        }
        else if (buffer instanceof DataView) {
            data = new Uint8Array(buffer.buffer, buffer.byteOffset + actualOffset, actualLength);
        }
        else {
            data = new Uint8Array(buffer.buffer, buffer.byteOffset + actualOffset, actualLength);
        }
        const writeOps = [builder_1.nfs.WRITE(this.stateid, writePos, 2, data)];
        const response = await this.client.fs.compound(writeOps);
        if (response.status !== 0) {
            throw new Error(`Failed to write file: ${response.status}`);
        }
        const writeRes = response.resarray[0];
        if (writeRes.status !== 0 || !writeRes.resok) {
            throw new Error(`Failed to write file: ${writeRes.status}`);
        }
        const resultBuffer = buffer instanceof Uint8Array || Buffer.isBuffer(buffer) ? buffer : new Uint8Array(buffer.buffer);
        return { bytesWritten: writeRes.resok.count, buffer: resultBuffer };
    }
    async writeFile(data, options) {
        if (this.closed)
            throw new Error('File handle is closed');
        return this.client.writeFile(this.path, data, options);
    }
    async readv(buffers, position) {
        if (this.closed)
            throw new Error('File handle is closed');
        let currentPosition = position !== null && position !== undefined ? BigInt(position) : BigInt(0);
        let totalBytesRead = 0;
        for (const buffer of buffers) {
            const readOps = [builder_1.nfs.READ(currentPosition, buffer.byteLength, this.stateid)];
            const response = await this.client.fs.compound(readOps);
            if (response.status !== 0) {
                throw new Error(`Failed to read file: ${response.status}`);
            }
            const readRes = response.resarray[0];
            if (readRes.status !== 0 || !readRes.resok) {
                throw new Error(`Failed to read file: ${readRes.status}`);
            }
            const data = readRes.resok.data;
            const bytesToCopy = Math.min(data.length, buffer.byteLength);
            const uint8View = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            for (let i = 0; i < bytesToCopy; i++) {
                uint8View[i] = data[i];
            }
            totalBytesRead += bytesToCopy;
            currentPosition += BigInt(bytesToCopy);
            if (readRes.resok.eof || bytesToCopy < buffer.byteLength)
                break;
        }
        return { bytesRead: totalBytesRead, buffers };
    }
    async writev(buffers, position) {
        if (this.closed)
            throw new Error('File handle is closed');
        let currentPosition = position !== null && position !== undefined ? BigInt(position) : BigInt(0);
        let totalBytesWritten = 0;
        for (const buffer of buffers) {
            const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const writeOps = [builder_1.nfs.WRITE(this.stateid, currentPosition, 2, data)];
            const response = await this.client.fs.compound(writeOps);
            if (response.status !== 0) {
                throw new Error(`Failed to write file: ${response.status}`);
            }
            const writeRes = response.resarray[0];
            if (writeRes.status !== 0 || !writeRes.resok) {
                throw new Error(`Failed to write file: ${writeRes.status}`);
            }
            totalBytesWritten += writeRes.resok.count;
            currentPosition += BigInt(writeRes.resok.count);
        }
        return { bytesWritten: totalBytesWritten, buffers };
    }
    readableWebStream(options) {
        if (this.closed)
            throw new Error('File handle is closed');
        const stream = this.createReadStream(options);
        return stream_1.Readable.toWeb(stream);
    }
    createReadStream(options) {
        if (this.closed)
            throw new Error('File handle is closed');
        const start = options?.start ?? 0;
        const end = options?.end;
        const highWaterMark = options?.highWaterMark ?? 64 * 1024;
        let position = typeof start === 'number' ? start : 0;
        const endPosition = typeof end === 'number' ? end : Infinity;
        let reading = false;
        const self = this;
        const stream = new stream_1.Readable({
            highWaterMark,
            async read(size) {
                if (reading)
                    return;
                reading = true;
                try {
                    while (true) {
                        if (position >= endPosition) {
                            this.push(null);
                            break;
                        }
                        const bytesToRead = Math.min(size, endPosition - position);
                        if (bytesToRead <= 0) {
                            this.push(null);
                            break;
                        }
                        const buffer = Buffer.alloc(bytesToRead);
                        const result = await self.read(buffer, 0, bytesToRead, position);
                        if (result.bytesRead === 0) {
                            this.push(null);
                            break;
                        }
                        position += result.bytesRead;
                        const chunk = buffer.slice(0, result.bytesRead);
                        if (!this.push(chunk))
                            break;
                        if (result.bytesRead < bytesToRead) {
                            this.push(null);
                            break;
                        }
                    }
                }
                catch (err) {
                    this.destroy(err);
                }
                finally {
                    reading = false;
                }
            },
        });
        stream.path = this.path;
        return stream;
    }
    createWriteStream(options) {
        if (this.closed)
            throw new Error('File handle is closed');
        const start = options?.start ?? 0;
        const highWaterMark = options?.highWaterMark ?? 64 * 1024;
        let position = typeof start === 'number' ? start : 0;
        const self = this;
        const stream = new stream_1.Writable({
            highWaterMark,
            async write(chunk, encoding, callback) {
                try {
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    const result = await self.write(buffer, 0, buffer.length, position);
                    position += result.bytesWritten;
                    callback();
                }
                catch (err) {
                    callback(err);
                }
            },
            async writev(chunks, callback) {
                try {
                    const buffers = chunks.map(({ chunk }) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                    const result = await self.writev(buffers, position);
                    position += result.bytesWritten;
                    callback();
                }
                catch (err) {
                    callback(err);
                }
            },
        });
        stream.path = this.path;
        return stream;
    }
}
exports.NfsFsFileHandle = NfsFsFileHandle;
//# sourceMappingURL=NfsFsFileHandle.js.map