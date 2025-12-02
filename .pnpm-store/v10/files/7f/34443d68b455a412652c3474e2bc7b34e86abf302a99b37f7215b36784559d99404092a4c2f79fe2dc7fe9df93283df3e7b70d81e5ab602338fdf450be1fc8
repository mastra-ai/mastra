"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpNameFromRequest = exports.getOpName = exports.getProcName = exports.toHex = void 0;
const tslib_1 = require("tslib");
const msg = tslib_1.__importStar(require("../messages"));
const toHex = (buffer) => {
    return Array.from(buffer)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};
exports.toHex = toHex;
const getProcName = (proc) => {
    switch (proc) {
        case 0:
            return 'NULL';
        case 1:
            return 'COMPOUND';
    }
    return 'UNKNOWN(' + proc + ')';
};
exports.getProcName = getProcName;
const getOpName = (op) => {
    switch (op) {
        case 3:
            return 'ACCESS';
        case 4:
            return 'CLOSE';
        case 5:
            return 'COMMIT';
        case 6:
            return 'CREATE';
        case 7:
            return 'DELEGPURGE';
        case 8:
            return 'DELEGRETURN';
        case 9:
            return 'GETATTR';
        case 10:
            return 'GETFH';
        case 11:
            return 'LINK';
        case 12:
            return 'LOCK';
        case 13:
            return 'LOCKT';
        case 14:
            return 'LOCKU';
        case 15:
            return 'LOOKUP';
        case 16:
            return 'LOOKUPP';
        case 17:
            return 'NVERIFY';
        case 18:
            return 'OPEN';
        case 19:
            return 'OPENATTR';
        case 20:
            return 'OPEN_CONFIRM';
        case 21:
            return 'OPEN_DOWNGRADE';
        case 22:
            return 'PUTFH';
        case 23:
            return 'PUTPUBFH';
        case 24:
            return 'PUTROOTFH';
        case 25:
            return 'READ';
        case 26:
            return 'READDIR';
        case 27:
            return 'READLINK';
        case 28:
            return 'REMOVE';
        case 29:
            return 'RENAME';
        case 30:
            return 'RENEW';
        case 31:
            return 'RESTOREFH';
        case 32:
            return 'SAVEFH';
        case 33:
            return 'SECINFO';
        case 34:
            return 'SETATTR';
        case 35:
            return 'SETCLIENTID';
        case 36:
            return 'SETCLIENTID_CONFIRM';
        case 37:
            return 'VERIFY';
        case 38:
            return 'WRITE';
        case 39:
            return 'RELEASE_LOCKOWNER';
        case 10044:
            return 'ILLEGAL';
    }
    return 'UNKNOWN(' + op + ')';
};
exports.getOpName = getOpName;
const getOpNameFromRequest = (op) => {
    if (op instanceof msg.Nfsv4AccessRequest)
        return 'ACCESS';
    if (op instanceof msg.Nfsv4CloseRequest)
        return 'CLOSE';
    if (op instanceof msg.Nfsv4CommitRequest)
        return 'COMMIT';
    if (op instanceof msg.Nfsv4CreateRequest)
        return 'CREATE';
    if (op instanceof msg.Nfsv4DelegpurgeRequest)
        return 'DELEGPURGE';
    if (op instanceof msg.Nfsv4DelegreturnRequest)
        return 'DELEGRETURN';
    if (op instanceof msg.Nfsv4GetattrRequest)
        return 'GETATTR';
    if (op instanceof msg.Nfsv4GetfhRequest)
        return 'GETFH';
    if (op instanceof msg.Nfsv4LinkRequest)
        return 'LINK';
    if (op instanceof msg.Nfsv4LockRequest)
        return 'LOCK';
    if (op instanceof msg.Nfsv4LocktRequest)
        return 'LOCKT';
    if (op instanceof msg.Nfsv4LockuRequest)
        return 'LOCKU';
    if (op instanceof msg.Nfsv4LookupRequest)
        return 'LOOKUP';
    if (op instanceof msg.Nfsv4LookuppRequest)
        return 'LOOKUPP';
    if (op instanceof msg.Nfsv4NverifyRequest)
        return 'NVERIFY';
    if (op instanceof msg.Nfsv4OpenRequest)
        return 'OPEN';
    if (op instanceof msg.Nfsv4OpenattrRequest)
        return 'OPENATTR';
    if (op instanceof msg.Nfsv4OpenConfirmRequest)
        return 'OPEN_CONFIRM';
    if (op instanceof msg.Nfsv4OpenDowngradeRequest)
        return 'OPEN_DOWNGRADE';
    if (op instanceof msg.Nfsv4PutfhRequest)
        return 'PUTFH';
    if (op instanceof msg.Nfsv4PutpubfhRequest)
        return 'PUTPUBFH';
    if (op instanceof msg.Nfsv4PutrootfhRequest)
        return 'PUTROOTFH';
    if (op instanceof msg.Nfsv4ReadRequest)
        return 'READ';
    if (op instanceof msg.Nfsv4ReaddirRequest)
        return 'READDIR';
    if (op instanceof msg.Nfsv4ReadlinkRequest)
        return 'READLINK';
    if (op instanceof msg.Nfsv4RemoveRequest)
        return 'REMOVE';
    if (op instanceof msg.Nfsv4RenameRequest)
        return 'RENAME';
    if (op instanceof msg.Nfsv4RenewRequest)
        return 'RENEW';
    if (op instanceof msg.Nfsv4RestorefhRequest)
        return 'RESTOREFH';
    if (op instanceof msg.Nfsv4SavefhRequest)
        return 'SAVEFH';
    if (op instanceof msg.Nfsv4SecinfoRequest)
        return 'SECINFO';
    if (op instanceof msg.Nfsv4SetattrRequest)
        return 'SETATTR';
    if (op instanceof msg.Nfsv4SetclientidRequest)
        return 'SETCLIENTID';
    if (op instanceof msg.Nfsv4SetclientidConfirmRequest)
        return 'SETCLIENTID_CONFIRM';
    if (op instanceof msg.Nfsv4VerifyRequest)
        return 'VERIFY';
    if (op instanceof msg.Nfsv4WriteRequest)
        return 'WRITE';
    if (op instanceof msg.Nfsv4ReleaseLockOwnerRequest)
        return 'RELEASE_LOCKOWNER';
    if (op instanceof msg.Nfsv4IllegalRequest)
        return 'ILLEGAL';
    return 'UNKNOWN';
};
exports.getOpNameFromRequest = getOpNameFromRequest;
//# sourceMappingURL=util.js.map