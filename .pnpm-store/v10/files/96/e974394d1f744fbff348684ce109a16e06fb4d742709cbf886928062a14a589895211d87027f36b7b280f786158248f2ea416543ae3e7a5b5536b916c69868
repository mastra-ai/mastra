"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfsFsStats = void 0;
class NfsFsStats {
    constructor(uid, gid, rdev, blksize, ino, size, blocks, atime, mtime, ctime, birthtime, atimeMs, mtimeMs, ctimeMs, birthtimeMs, dev, mode, nlink, type) {
        this.uid = uid;
        this.gid = gid;
        this.rdev = rdev;
        this.blksize = blksize;
        this.ino = ino;
        this.size = size;
        this.blocks = blocks;
        this.atime = atime;
        this.mtime = mtime;
        this.ctime = ctime;
        this.birthtime = birthtime;
        this.atimeMs = atimeMs;
        this.mtimeMs = mtimeMs;
        this.ctimeMs = ctimeMs;
        this.birthtimeMs = birthtimeMs;
        this.dev = dev;
        this.mode = mode;
        this.nlink = nlink;
        this.type = type;
    }
    isDirectory() {
        return this.type === 2;
    }
    isFile() {
        return this.type === 1;
    }
    isBlockDevice() {
        return this.type === 3;
    }
    isCharacterDevice() {
        return this.type === 4;
    }
    isSymbolicLink() {
        return this.type === 5;
    }
    isFIFO() {
        return this.type === 7;
    }
    isSocket() {
        return this.type === 6;
    }
}
exports.NfsFsStats = NfsFsStats;
//# sourceMappingURL=NfsFsStats.js.map