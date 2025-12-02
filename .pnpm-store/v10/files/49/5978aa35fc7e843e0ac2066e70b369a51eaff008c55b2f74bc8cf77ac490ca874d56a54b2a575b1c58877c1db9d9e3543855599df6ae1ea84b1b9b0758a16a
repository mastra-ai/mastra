"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHandleMapper = exports.decodePathFh = exports.encodePathFh = exports.ROOT_FH = void 0;
const encode_1 = require("@jsonjoy.com/buffers/lib/utf8/encode");
const decodeUtf8_1 = require("@jsonjoy.com/buffers/lib/utf8/decodeUtf8");
const node_crypto_1 = require("node:crypto");
exports.ROOT_FH = new Uint8Array([0]);
const encodePathFh = (absolutePath) => {
    const utf8Length = Buffer.byteLength(absolutePath, 'utf8');
    if (utf8Length + 1 > 128)
        return undefined;
    const u8 = new Uint8Array(1 + utf8Length);
    u8[0] = 1;
    (0, encode_1.encode)(u8, absolutePath, 1, utf8Length);
    return u8;
};
exports.encodePathFh = encodePathFh;
const decodePathFh = (fh) => {
    const length = fh.length;
    if (length < 2)
        return undefined;
    if (fh[0] !== 1)
        return undefined;
    return (0, decodeUtf8_1.decodeUtf8)(fh, 1, length - 1);
};
exports.decodePathFh = decodePathFh;
class FileHandleMapper {
    constructor(stamp, dir) {
        this.dir = dir;
        this.idToPath = new Map();
        this.pathToId = new Map();
        this.maxFhTableSize = 100000;
        this.stamp = stamp & 0xffff;
    }
    decode(fh) {
        const length = fh.length;
        if (fh.length === 0)
            return this.dir;
        const type = fh[0];
        if (type === 0)
            return this.dir;
        if (type === 1) {
            try {
                const path = (0, exports.decodePathFh)(fh);
                if (!path)
                    throw 10001;
                return path;
            }
            catch {
                throw 10001;
            }
        }
        if (type === 2) {
            if (length !== 8)
                throw 10001;
            const stamp = (fh[1] << 8) | fh[2];
            if (stamp !== this.stamp)
                throw 10014;
            const id = fh[3] * 0x100000000 + fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
            const path = this.idToPath.get(id);
            if (!path)
                throw 10014;
            return path;
        }
        throw 10001;
    }
    encode(path) {
        if (path === this.dir)
            return exports.ROOT_FH;
        let fh = this.pathToId.get(path);
        if (fh)
            return fh;
        fh = (0, node_crypto_1.randomBytes)(8);
        fh[0] = 2;
        fh[1] = (this.stamp >> 8) & 0xff;
        fh[2] = this.stamp & 0xff;
        const id = fh[3] * 0x100000000 + fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
        const { idToPath, pathToId, maxFhTableSize } = this;
        ENFORCE_FH_TABLE_SIZE_LIMIT: {
            if (idToPath.size <= maxFhTableSize)
                break ENFORCE_FH_TABLE_SIZE_LIMIT;
            const entry = idToPath.entries().next().value;
            if (entry) {
                const [id, path] = entry;
                idToPath.delete(id);
                pathToId.delete(path);
            }
        }
        idToPath.set(id, path);
        pathToId.set(path, fh);
        return fh;
    }
    validate(fh) {
        if (fh.length === 0)
            return true;
        const type = fh[0];
        if (type === 0)
            return true;
        if (type === 1)
            return true;
        if (type === 2)
            return true;
        return false;
    }
    currentPath(ctx) {
        const cfh = ctx.cfh;
        if (!cfh)
            throw 10020;
        return this.decode(cfh);
    }
    savedPath(ctx) {
        const sfh = ctx.sfh;
        if (!sfh)
            throw 10020;
        return this.decode(sfh);
    }
    setCfh(ctx, path) {
        const newFh = this.encode(path);
        ctx.cfh = newFh;
    }
    remove(path) {
        const fh = this.pathToId.get(path);
        if (!fh)
            return;
        const type = fh[0];
        if (type !== 2)
            return;
        const id = fh[3] * 0x100000000 + fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
        this.pathToId.delete(path);
        this.idToPath.delete(id);
    }
    rename(oldPath, newPath) {
        this.remove(newPath);
        const fh = this.pathToId.get(oldPath);
        if (!fh)
            return;
        const type = fh[0];
        if (type !== 2)
            return;
        const id = fh[3] * 0x100000000 + fh[4] * 0x1000000 + (fh[5] << 16) + (fh[6] << 8) + fh[7];
        this.pathToId.delete(oldPath);
        this.pathToId.set(newPath, fh);
        this.idToPath.set(id, newPath);
    }
}
exports.FileHandleMapper = FileHandleMapper;
//# sourceMappingURL=fh.js.map