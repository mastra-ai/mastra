"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockStateid = void 0;
const tslib_1 = require("tslib");
const struct = tslib_1.__importStar(require("../../structs"));
class LockStateid {
    constructor(other, seqid, lockOwnerKey, path) {
        this.other = other;
        this.seqid = seqid;
        this.lockOwnerKey = lockOwnerKey;
        this.path = path;
    }
    toStateid() {
        return new struct.Nfsv4Stateid(this.seqid, this.other);
    }
    incrementAndGetStateid() {
        this.seqid = this.seqid === 0xffffffff ? 1 : this.seqid + 1;
        return this.toStateid();
    }
}
exports.LockStateid = LockStateid;
//# sourceMappingURL=LockStateid.js.map