"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
const fanout_1 = require("thingies/lib/fanout");
const process_1 = require("../process");
const buffer_1 = require("../vendor/node/internal/buffer");
const constants_1 = require("../constants");
const { S_IFMT, S_IFDIR, S_IFREG, S_IFLNK, S_IFCHR } = constants_1.constants;
const getuid = () => process_1.default.getuid?.() ?? 0;
const getgid = () => process_1.default.getgid?.() ?? 0;
const EMPTY_BUFFER = (0, buffer_1.bufferAllocUnsafe)(0);
/**
 * Node in a file system (like i-node, v-node).
 */
class Node {
    constructor(ino, mode = 0o666) {
        this.changes = new fanout_1.FanOut();
        // User ID and group ID.
        this._uid = getuid();
        this._gid = getgid();
        this._atime = new Date();
        this._mtime = new Date();
        this._ctime = new Date();
        this.buf = EMPTY_BUFFER;
        /** Total allocated memory capacity for this node. */
        this.capacity = 0;
        /** Actually used bytes to store content. */
        this.size = 0;
        this.rdev = 0;
        // Number of hard links pointing at this Node.
        this._nlink = 1;
        this.mode = mode;
        this.ino = ino;
    }
    set ctime(ctime) {
        this._ctime = ctime;
    }
    get ctime() {
        return this._ctime;
    }
    set uid(uid) {
        this._uid = uid;
        this.ctime = new Date();
    }
    get uid() {
        return this._uid;
    }
    set gid(gid) {
        this._gid = gid;
        this.ctime = new Date();
    }
    get gid() {
        return this._gid;
    }
    set atime(atime) {
        this._atime = atime;
    }
    get atime() {
        return this._atime;
    }
    set mtime(mtime) {
        this._mtime = mtime;
        this.ctime = new Date();
    }
    get mtime() {
        return this._mtime;
    }
    get perm() {
        return this.mode & ~S_IFMT;
    }
    set perm(perm) {
        this.mode = (this.mode & S_IFMT) | (perm & ~S_IFMT);
        this.ctime = new Date();
    }
    set nlink(nlink) {
        this._nlink = nlink;
        this.ctime = new Date();
    }
    get nlink() {
        return this._nlink;
    }
    getString(encoding = 'utf8') {
        this.atime = new Date();
        return this.getBuffer().toString(encoding);
    }
    setString(str) {
        this._setBuf((0, buffer_1.bufferFrom)(str, 'utf8'));
    }
    getBuffer() {
        this.atime = new Date();
        if (!this.buf)
            this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
        return (0, buffer_1.bufferFrom)(this.buf.subarray(0, this.size)); // Return a copy of used portion.
    }
    setBuffer(buf) {
        const copy = (0, buffer_1.bufferFrom)(buf); // Creates a copy of data.
        this._setBuf(copy);
    }
    _setBuf(buf) {
        const size = buf.length;
        this.buf = buf;
        this.capacity = size;
        this.size = size;
        this.touch();
    }
    getSize() {
        return this.size;
    }
    setModeProperty(property) {
        this.mode = property;
    }
    isFile() {
        return (this.mode & S_IFMT) === S_IFREG;
    }
    isDirectory() {
        return (this.mode & S_IFMT) === S_IFDIR;
    }
    isSymlink() {
        // return !!this.symlink;
        return (this.mode & S_IFMT) === S_IFLNK;
    }
    isCharacterDevice() {
        return (this.mode & S_IFMT) === S_IFCHR;
    }
    makeSymlink(symlink) {
        this.mode = S_IFLNK | 0o666;
        this.symlink = symlink;
    }
    write(buf, off = 0, len = buf.length, pos = 0) {
        const bufLength = buf.length;
        if (off + len > bufLength)
            len = bufLength - off;
        if (len <= 0)
            return 0;
        const requiredSize = pos + len;
        if (requiredSize > this.capacity) {
            let newCapacity = Math.max(this.capacity * 2, 64);
            while (newCapacity < requiredSize)
                newCapacity *= 2;
            const newBuf = (0, buffer_1.bufferAllocUnsafe)(newCapacity);
            if (this.size > 0)
                this.buf.copy(newBuf, 0, 0, this.size);
            this.buf = newBuf;
            this.capacity = newCapacity;
        }
        if (pos > this.size)
            this.buf.fill(0, this.size, pos);
        buf.copy(this.buf, pos, off, off + len);
        if (requiredSize > this.size)
            this.size = requiredSize;
        this.touch();
        return len;
    }
    /**
     * Read data from the file.
     *
     * @param buf Buffer to read data into.
     * @param off Offset int the `buf` where to start writing data.
     * @param len How many bytes to read. Equals to `buf.byteLength` by default.
     * @param pos Position offset in file where to start reading. Defaults to `0`.
     * @returns Returns the number of bytes read.
     */
    read(buf, off = 0, len = buf.byteLength, pos = 0) {
        this.atime = new Date();
        if (pos >= this.size)
            return 0;
        let actualLen = len;
        if (actualLen > buf.byteLength)
            actualLen = buf.byteLength;
        if (actualLen + pos > this.size)
            actualLen = this.size - pos;
        if (actualLen <= 0)
            return 0;
        const buf2 = buf instanceof buffer_1.Buffer ? buf : buffer_1.Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
        this.buf.copy(buf2, off, pos, pos + actualLen);
        return actualLen;
    }
    truncate(len = 0) {
        if (!len) {
            this.buf = EMPTY_BUFFER;
            this.capacity = 0;
            this.size = 0;
            this.touch();
            return;
        }
        if (len <= this.size)
            this.size = len;
        else {
            if (len > this.capacity) {
                let newCapacity = Math.max(this.capacity * 2, 64);
                while (newCapacity < len)
                    newCapacity *= 2;
                const buf = (0, buffer_1.bufferAllocUnsafe)(newCapacity);
                if (this.size > 0)
                    this.buf.copy(buf, 0, 0, this.size);
                buf.fill(0, this.size, len);
                this.buf = buf;
                this.capacity = newCapacity;
            }
            else
                this.buf.fill(0, this.size, len);
            this.size = len;
        }
        this.touch();
    }
    chmod(perm) {
        this.mode = (this.mode & S_IFMT) | (perm & ~S_IFMT);
        this.touch();
    }
    chown(uid, gid) {
        this.uid = uid;
        this.gid = gid;
        this.touch();
    }
    touch() {
        this.mtime = new Date();
        this.changes.emit(['modify']);
    }
    canRead(uid = getuid(), gid = getgid()) {
        if (this.perm & 4 /* S.IROTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 32 /* S.IRGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 256 /* S.IRUSR */) {
                return true;
            }
        }
        return false;
    }
    canWrite(uid = getuid(), gid = getgid()) {
        if (this.perm & 2 /* S.IWOTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 16 /* S.IWGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 128 /* S.IWUSR */) {
                return true;
            }
        }
        return false;
    }
    canExecute(uid = getuid(), gid = getgid()) {
        if (this.perm & 1 /* S.IXOTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 8 /* S.IXGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 64 /* S.IXUSR */) {
                return true;
            }
        }
        return false;
    }
    del() {
        this.changes.emit(['delete']);
    }
    toJSON() {
        return {
            ino: this.ino,
            uid: this.uid,
            gid: this.gid,
            atime: this.atime.getTime(),
            mtime: this.mtime.getTime(),
            ctime: this.ctime.getTime(),
            perm: this.perm,
            mode: this.mode,
            nlink: this.nlink,
            symlink: this.symlink,
            data: this.getString(),
        };
    }
}
exports.Node = Node;
//# sourceMappingURL=Node.js.map