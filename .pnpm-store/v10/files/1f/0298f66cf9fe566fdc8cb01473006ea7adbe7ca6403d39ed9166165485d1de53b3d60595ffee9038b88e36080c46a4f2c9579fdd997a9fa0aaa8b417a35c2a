"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nfs = void 0;
const tslib_1 = require("tslib");
const attributes_1 = require("./attributes");
const msg = tslib_1.__importStar(require("./messages"));
const structs = tslib_1.__importStar(require("./structs"));
exports.nfs = {
    PUTROOTFH() {
        return new msg.Nfsv4PutrootfhRequest();
    },
    PUTFH(fh) {
        return new msg.Nfsv4PutfhRequest(fh);
    },
    PUTPUBFH() {
        return new msg.Nfsv4PutpubfhRequest();
    },
    GETFH() {
        return new msg.Nfsv4GetfhRequest();
    },
    LOOKUP(name) {
        return new msg.Nfsv4LookupRequest(name);
    },
    LOOKUPP() {
        return new msg.Nfsv4LookuppRequest();
    },
    GETATTR(attrBitmap) {
        return new msg.Nfsv4GetattrRequest(new structs.Nfsv4Bitmap(attrBitmap));
    },
    READDIR(attrBitmap, cookieverf, cookie, dircount, maxcount) {
        const bitmap = Array.isArray(attrBitmap) ? attrBitmap : [attrBitmap];
        const verifier = cookieverf || new Uint8Array(8);
        return new msg.Nfsv4ReaddirRequest(cookie ?? BigInt(0), new structs.Nfsv4Verifier(verifier), dircount ?? 1000, maxcount ?? 8192, new structs.Nfsv4Bitmap(bitmap));
    },
    ACCESS(accessMask = 0x0000003f) {
        return new msg.Nfsv4AccessRequest(accessMask);
    },
    READ(offset, count, stateid) {
        const sid = stateid || new structs.Nfsv4Stateid(0, new Uint8Array(12));
        return new msg.Nfsv4ReadRequest(sid, offset, count);
    },
    WRITE(stateid, offset, stable, data) {
        return new msg.Nfsv4WriteRequest(stateid, offset, stable, data);
    },
    COMMIT(offset, count) {
        return new msg.Nfsv4CommitRequest(offset, count);
    },
    CREATE(objtype, objname, createattrs) {
        return new msg.Nfsv4CreateRequest(objtype, objname, createattrs);
    },
    LINK(newname) {
        return new msg.Nfsv4LinkRequest(newname);
    },
    READLINK() {
        return new msg.Nfsv4ReadlinkRequest();
    },
    SAVEFH() {
        return new msg.Nfsv4SavefhRequest();
    },
    RESTOREFH() {
        return new msg.Nfsv4RestorefhRequest();
    },
    SETATTR(stateid, attrs) {
        return new msg.Nfsv4SetattrRequest(stateid, attrs);
    },
    VERIFY(attrs) {
        return new msg.Nfsv4VerifyRequest(attrs);
    },
    NVERIFY(attrs) {
        return new msg.Nfsv4NverifyRequest(attrs);
    },
    REMOVE(name) {
        return new msg.Nfsv4RemoveRequest(name);
    },
    RENAME(oldname, newname) {
        return new msg.Nfsv4RenameRequest(oldname, newname);
    },
    RENEW(clientid) {
        return new msg.Nfsv4RenewRequest(clientid);
    },
    SETCLIENTID(client, callback, callbackIdent) {
        return new msg.Nfsv4SetclientidRequest(client, callback, callbackIdent);
    },
    SETCLIENTID_CONFIRM(clientid, verifier) {
        return new msg.Nfsv4SetclientidConfirmRequest(clientid, verifier);
    },
    OPEN(seqid, shareAccess, shareDeny, owner, openhow, claim) {
        return new msg.Nfsv4OpenRequest(seqid, shareAccess, shareDeny, owner, openhow, claim);
    },
    CLOSE(seqid, openStateid) {
        return new msg.Nfsv4CloseRequest(seqid, openStateid);
    },
    OPEN_CONFIRM(openStateid, seqid) {
        return new msg.Nfsv4OpenConfirmRequest(openStateid, seqid);
    },
    OPEN_DOWNGRADE(openStateid, seqid, shareAccess, shareDeny) {
        return new msg.Nfsv4OpenDowngradeRequest(openStateid, seqid, shareAccess, shareDeny);
    },
    OPENATTR(createdir = false) {
        return new msg.Nfsv4OpenattrRequest(createdir);
    },
    SECINFO(name) {
        return new msg.Nfsv4SecinfoRequest(name);
    },
    DELEGPURGE(clientid) {
        return new msg.Nfsv4DelegpurgeRequest(clientid);
    },
    DELEGRETURN(stateid) {
        return new msg.Nfsv4DelegreturnRequest(stateid);
    },
    LOCK(locktype, reclaim, offset, length, locker) {
        return new msg.Nfsv4LockRequest(locktype, reclaim, offset, length, locker);
    },
    LOCKT(locktype, offset, length, owner) {
        return new msg.Nfsv4LocktRequest(locktype, offset, length, owner);
    },
    LOCKU(locktype, seqid, lockStateid, offset, length) {
        return new msg.Nfsv4LockuRequest(locktype, seqid, lockStateid, offset, length);
    },
    RELEASE_LOCKOWNER(lockOwner) {
        return new msg.Nfsv4ReleaseLockOwnerRequest(lockOwner);
    },
    Verifier(data) {
        return new structs.Nfsv4Verifier(data || new Uint8Array(8));
    },
    Stateid(seqid = 0, other) {
        return new structs.Nfsv4Stateid(seqid, other || new Uint8Array(12));
    },
    Fattr(attrNums, attrVals) {
        const bitmap = new structs.Nfsv4Bitmap((0, attributes_1.attrNumsToBitmap)(attrNums));
        return new structs.Nfsv4Fattr(bitmap, attrVals);
    },
    ClientId(verifier, id) {
        return new structs.Nfsv4ClientId(verifier, id);
    },
    CbClient(cbProgram, rNetid, rAddr) {
        const cbLocation = new structs.Nfsv4ClientAddr(rNetid, rAddr);
        return new structs.Nfsv4CbClient(cbProgram, cbLocation);
    },
    Bitmap(attrNums) {
        return new structs.Nfsv4Bitmap((0, attributes_1.attrNumsToBitmap)(attrNums));
    },
    CreateTypeFile() {
        return new structs.Nfsv4CreateType(1, new structs.Nfsv4CreateTypeVoid());
    },
    CreateTypeDir() {
        return new structs.Nfsv4CreateType(2, new structs.Nfsv4CreateTypeVoid());
    },
    OpenOwner(clientid, owner) {
        return new structs.Nfsv4OpenOwner(clientid, owner);
    },
    OpenClaimNull(filename) {
        return new structs.Nfsv4OpenClaim(0, new structs.Nfsv4OpenClaimNull(filename));
    },
    OpenHowNoCreate() {
        return new structs.Nfsv4OpenHow(0);
    },
    OpenHowCreateUnchecked(createattrs) {
        const attrs = createattrs || new structs.Nfsv4Fattr(new structs.Nfsv4Bitmap([]), new Uint8Array(0));
        const how = new structs.Nfsv4CreateHow(0, new structs.Nfsv4CreateAttrs(attrs));
        return new structs.Nfsv4OpenHow(1, how);
    },
    OpenHowCreateGuarded(createattrs) {
        const attrs = createattrs || new structs.Nfsv4Fattr(new structs.Nfsv4Bitmap([]), new Uint8Array(0));
        const how = new structs.Nfsv4CreateHow(1, new structs.Nfsv4CreateAttrs(attrs));
        return new structs.Nfsv4OpenHow(1, how);
    },
    OpenHowCreateExclusive(verifier) {
        const how = new structs.Nfsv4CreateHow(2, new structs.Nfsv4CreateVerf(verifier));
        return new structs.Nfsv4OpenHow(1, how);
    },
    LockOwner(clientid, owner) {
        return new structs.Nfsv4LockOwner(clientid, owner);
    },
    NewLockOwner(openSeqid, openStateid, lockSeqid, lockOwner) {
        const openToLockOwner = new structs.Nfsv4OpenToLockOwner(openSeqid, openStateid, lockSeqid, lockOwner);
        return new structs.Nfsv4LockOwnerInfo(true, new structs.Nfsv4LockNewOwner(openToLockOwner));
    },
    ExistingLockOwner(lockStateid, lockSeqid) {
        const owner = new structs.Nfsv4LockExistingOwner(lockStateid, lockSeqid);
        return new structs.Nfsv4LockOwnerInfo(false, owner);
    },
    ILLEGAL() {
        return new msg.Nfsv4IllegalRequest();
    },
};
//# sourceMappingURL=builder.js.map