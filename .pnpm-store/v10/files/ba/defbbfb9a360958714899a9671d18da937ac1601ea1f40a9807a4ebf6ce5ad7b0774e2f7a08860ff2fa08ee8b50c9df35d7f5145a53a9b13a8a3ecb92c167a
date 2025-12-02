"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ByteRangeLock = void 0;
class ByteRangeLock {
    constructor(stateid, path, locktype, offset, length, lockOwnerKey) {
        this.stateid = stateid;
        this.path = path;
        this.locktype = locktype;
        this.offset = offset;
        this.length = length;
        this.lockOwnerKey = lockOwnerKey;
    }
    overlaps(offset, length) {
        const MAX_UINT64 = BigInt('0xFFFFFFFFFFFFFFFF');
        const thisEnd = this.length === MAX_UINT64 ? MAX_UINT64 : this.offset + this.length;
        const otherEnd = length === MAX_UINT64 ? MAX_UINT64 : offset + length;
        return this.offset < otherEnd && offset < thisEnd;
    }
}
exports.ByteRangeLock = ByteRangeLock;
//# sourceMappingURL=ByteRangeLock.js.map