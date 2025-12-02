"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4OpenDowngradeRequest = exports.Nfsv4OpenConfirmResponse = exports.Nfsv4OpenConfirmResOk = exports.Nfsv4OpenConfirmRequest = exports.Nfsv4OpenattrResponse = exports.Nfsv4OpenattrRequest = exports.Nfsv4OpenResponse = exports.Nfsv4OpenResOk = exports.Nfsv4OpenRequest = exports.Nfsv4NverifyResponse = exports.Nfsv4NverifyRequest = exports.Nfsv4LookuppResponse = exports.Nfsv4LookuppRequest = exports.Nfsv4LookupResponse = exports.Nfsv4LookupRequest = exports.Nfsv4LockuResponse = exports.Nfsv4LockuResOk = exports.Nfsv4LockuRequest = exports.Nfsv4LocktResponse = exports.Nfsv4LocktResDenied = exports.Nfsv4LocktRequest = exports.Nfsv4LockResponse = exports.Nfsv4LockResDenied = exports.Nfsv4LockResOk = exports.Nfsv4LockRequest = exports.Nfsv4LinkResponse = exports.Nfsv4LinkResOk = exports.Nfsv4LinkRequest = exports.Nfsv4GetfhResponse = exports.Nfsv4GetfhResOk = exports.Nfsv4GetfhRequest = exports.Nfsv4GetattrResponse = exports.Nfsv4GetattrResOk = exports.Nfsv4GetattrRequest = exports.Nfsv4DelegreturnResponse = exports.Nfsv4DelegreturnRequest = exports.Nfsv4DelegpurgeResponse = exports.Nfsv4DelegpurgeRequest = exports.Nfsv4CreateResponse = exports.Nfsv4CreateResOk = exports.Nfsv4CreateRequest = exports.Nfsv4CommitResponse = exports.Nfsv4CommitResOk = exports.Nfsv4CommitRequest = exports.Nfsv4CloseResponse = exports.Nfsv4CloseResOk = exports.Nfsv4CloseRequest = exports.Nfsv4AccessResponse = exports.Nfsv4AccessResOk = exports.Nfsv4AccessRequest = void 0;
exports.Nfsv4CompoundRequest = exports.Nfsv4IllegalResponse = exports.Nfsv4IllegalRequest = exports.Nfsv4ReleaseLockOwnerResponse = exports.Nfsv4ReleaseLockOwnerRequest = exports.Nfsv4WriteResponse = exports.Nfsv4WriteResOk = exports.Nfsv4WriteRequest = exports.Nfsv4VerifyResponse = exports.Nfsv4VerifyRequest = exports.Nfsv4SetclientidConfirmResponse = exports.Nfsv4SetclientidConfirmRequest = exports.Nfsv4SetclientidResponse = exports.Nfsv4SetclientidResOk = exports.Nfsv4SetclientidRequest = exports.Nfsv4SetattrResponse = exports.Nfsv4SetattrResOk = exports.Nfsv4SetattrRequest = exports.Nfsv4SecinfoResponse = exports.Nfsv4SecinfoResOk = exports.Nfsv4SecinfoRequest = exports.Nfsv4SavefhResponse = exports.Nfsv4SavefhRequest = exports.Nfsv4RestorefhResponse = exports.Nfsv4RestorefhRequest = exports.Nfsv4RenewResponse = exports.Nfsv4RenewRequest = exports.Nfsv4RenameResponse = exports.Nfsv4RenameResOk = exports.Nfsv4RenameRequest = exports.Nfsv4RemoveResponse = exports.Nfsv4RemoveResOk = exports.Nfsv4RemoveRequest = exports.Nfsv4ReadlinkResponse = exports.Nfsv4ReadlinkResOk = exports.Nfsv4ReadlinkRequest = exports.Nfsv4ReaddirResponse = exports.Nfsv4ReaddirResOk = exports.Nfsv4ReaddirRequest = exports.Nfsv4ReadResponse = exports.Nfsv4ReadResOk = exports.Nfsv4ReadRequest = exports.Nfsv4PutrootfhResponse = exports.Nfsv4PutrootfhRequest = exports.Nfsv4PutpubfhResponse = exports.Nfsv4PutpubfhRequest = exports.Nfsv4PutfhResponse = exports.Nfsv4PutfhRequest = exports.Nfsv4OpenDowngradeResponse = exports.Nfsv4OpenDowngradeResOk = void 0;
exports.Nfsv4CbCompoundResponse = exports.Nfsv4CbCompoundRequest = exports.Nfsv4CbIllegalResponse = exports.Nfsv4CbIllegalRequest = exports.Nfsv4CbRecallResponse = exports.Nfsv4CbRecallRequest = exports.Nfsv4CbGetattrResponse = exports.Nfsv4CbGetattrResOk = exports.Nfsv4CbGetattrRequest = exports.Nfsv4CompoundResponse = void 0;
const tslib_1 = require("tslib");
const structs = tslib_1.__importStar(require("./structs"));
class Nfsv4AccessRequest {
    static decode(xdr) {
        const access = xdr.readUnsignedInt();
        return new Nfsv4AccessRequest(access);
    }
    constructor(access) {
        this.access = access;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(3);
        xdr.writeUnsignedInt(this.access);
    }
}
exports.Nfsv4AccessRequest = Nfsv4AccessRequest;
class Nfsv4AccessResOk {
    constructor(supported, access) {
        this.supported = supported;
        this.access = access;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.supported);
        xdr.writeUnsignedInt(this.access);
    }
}
exports.Nfsv4AccessResOk = Nfsv4AccessResOk;
class Nfsv4AccessResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(3);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4AccessResponse = Nfsv4AccessResponse;
class Nfsv4CloseRequest {
    static decode(xdr) {
        const seqid = xdr.readUnsignedInt();
        const openStateid = structs.Nfsv4Stateid.decode(xdr);
        return new Nfsv4CloseRequest(seqid, openStateid);
    }
    constructor(seqid, openStateid) {
        this.seqid = seqid;
        this.openStateid = openStateid;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(4);
        xdr.writeUnsignedInt(this.seqid);
        this.openStateid.encode(xdr);
    }
}
exports.Nfsv4CloseRequest = Nfsv4CloseRequest;
class Nfsv4CloseResOk {
    constructor(openStateid) {
        this.openStateid = openStateid;
    }
    encode(xdr) {
        this.openStateid.encode(xdr);
    }
}
exports.Nfsv4CloseResOk = Nfsv4CloseResOk;
class Nfsv4CloseResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(4);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4CloseResponse = Nfsv4CloseResponse;
class Nfsv4CommitRequest {
    static decode(xdr) {
        const offset = xdr.readUnsignedHyper();
        const count = xdr.readUnsignedInt();
        return new Nfsv4CommitRequest(offset, count);
    }
    constructor(offset, count) {
        this.offset = offset;
        this.count = count;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(5);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedInt(this.count);
    }
}
exports.Nfsv4CommitRequest = Nfsv4CommitRequest;
class Nfsv4CommitResOk {
    constructor(writeverf) {
        this.writeverf = writeverf;
    }
    encode(xdr) {
        this.writeverf.encode(xdr);
    }
}
exports.Nfsv4CommitResOk = Nfsv4CommitResOk;
class Nfsv4CommitResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(5);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4CommitResponse = Nfsv4CommitResponse;
class Nfsv4CreateRequest {
    constructor(objtype, objname, createattrs) {
        this.objtype = objtype;
        this.objname = objname;
        this.createattrs = createattrs;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(6);
        this.objtype.encode(xdr);
        xdr.writeStr(this.objname);
        this.createattrs.encode(xdr);
    }
}
exports.Nfsv4CreateRequest = Nfsv4CreateRequest;
class Nfsv4CreateResOk {
    constructor(cinfo, attrset) {
        this.cinfo = cinfo;
        this.attrset = attrset;
    }
    encode(xdr) {
        this.cinfo.encode(xdr);
        this.attrset.encode(xdr);
    }
}
exports.Nfsv4CreateResOk = Nfsv4CreateResOk;
class Nfsv4CreateResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(6);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4CreateResponse = Nfsv4CreateResponse;
class Nfsv4DelegpurgeRequest {
    static decode(xdr) {
        const clientid = xdr.readUnsignedHyper();
        return new Nfsv4DelegpurgeRequest(clientid);
    }
    constructor(clientid) {
        this.clientid = clientid;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(7);
        xdr.writeUnsignedHyper(this.clientid);
    }
}
exports.Nfsv4DelegpurgeRequest = Nfsv4DelegpurgeRequest;
class Nfsv4DelegpurgeResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(7);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4DelegpurgeResponse = Nfsv4DelegpurgeResponse;
class Nfsv4DelegreturnRequest {
    static decode(xdr) {
        const delegStateid = structs.Nfsv4Stateid.decode(xdr);
        return new Nfsv4DelegreturnRequest(delegStateid);
    }
    constructor(delegStateid) {
        this.delegStateid = delegStateid;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(8);
        this.delegStateid.encode(xdr);
    }
}
exports.Nfsv4DelegreturnRequest = Nfsv4DelegreturnRequest;
class Nfsv4DelegreturnResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(8);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4DelegreturnResponse = Nfsv4DelegreturnResponse;
class Nfsv4GetattrRequest {
    constructor(attrRequest) {
        this.attrRequest = attrRequest;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(9);
        this.attrRequest.encode(xdr);
    }
}
exports.Nfsv4GetattrRequest = Nfsv4GetattrRequest;
class Nfsv4GetattrResOk {
    constructor(objAttributes) {
        this.objAttributes = objAttributes;
    }
    encode(xdr) {
        this.objAttributes.encode(xdr);
    }
}
exports.Nfsv4GetattrResOk = Nfsv4GetattrResOk;
class Nfsv4GetattrResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(9);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4GetattrResponse = Nfsv4GetattrResponse;
class Nfsv4GetfhRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(10);
    }
}
exports.Nfsv4GetfhRequest = Nfsv4GetfhRequest;
class Nfsv4GetfhResOk {
    constructor(object) {
        this.object = object;
    }
    encode(xdr) {
        this.object.encode(xdr);
    }
}
exports.Nfsv4GetfhResOk = Nfsv4GetfhResOk;
class Nfsv4GetfhResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(10);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4GetfhResponse = Nfsv4GetfhResponse;
class Nfsv4LinkRequest {
    constructor(newname) {
        this.newname = newname;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(11);
        xdr.writeStr(this.newname);
    }
}
exports.Nfsv4LinkRequest = Nfsv4LinkRequest;
class Nfsv4LinkResOk {
    constructor(cinfo) {
        this.cinfo = cinfo;
    }
    encode(xdr) {
        this.cinfo.encode(xdr);
    }
}
exports.Nfsv4LinkResOk = Nfsv4LinkResOk;
class Nfsv4LinkResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(11);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4LinkResponse = Nfsv4LinkResponse;
class Nfsv4LockRequest {
    constructor(locktype, reclaim, offset, length, locker) {
        this.locktype = locktype;
        this.reclaim = reclaim;
        this.offset = offset;
        this.length = length;
        this.locker = locker;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(12);
        xdr.writeUnsignedInt(this.locktype);
        xdr.writeBoolean(this.reclaim);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedHyper(this.length);
        this.locker.encode(xdr);
    }
}
exports.Nfsv4LockRequest = Nfsv4LockRequest;
class Nfsv4LockResOk {
    constructor(lockStateid) {
        this.lockStateid = lockStateid;
    }
    encode(xdr) {
        this.lockStateid.encode(xdr);
    }
}
exports.Nfsv4LockResOk = Nfsv4LockResOk;
class Nfsv4LockResDenied {
    constructor(offset, length, locktype, owner) {
        this.offset = offset;
        this.length = length;
        this.locktype = locktype;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedHyper(this.length);
        xdr.writeUnsignedInt(this.locktype);
        this.owner.encode(xdr);
    }
}
exports.Nfsv4LockResDenied = Nfsv4LockResDenied;
class Nfsv4LockResponse {
    constructor(status, resok, denied) {
        this.status = status;
        this.resok = resok;
        this.denied = denied;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(12);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
        else if (this.denied) {
            this.denied.encode(xdr);
        }
    }
}
exports.Nfsv4LockResponse = Nfsv4LockResponse;
class Nfsv4LocktRequest {
    constructor(locktype, offset, length, owner) {
        this.locktype = locktype;
        this.offset = offset;
        this.length = length;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(13);
        xdr.writeUnsignedInt(this.locktype);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedHyper(this.length);
        this.owner.encode(xdr);
    }
}
exports.Nfsv4LocktRequest = Nfsv4LocktRequest;
class Nfsv4LocktResDenied {
    constructor(offset, length, locktype, owner) {
        this.offset = offset;
        this.length = length;
        this.locktype = locktype;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedHyper(this.length);
        xdr.writeUnsignedInt(this.locktype);
        this.owner.encode(xdr);
    }
}
exports.Nfsv4LocktResDenied = Nfsv4LocktResDenied;
class Nfsv4LocktResponse {
    constructor(status, denied) {
        this.status = status;
        this.denied = denied;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(13);
        xdr.writeUnsignedInt(this.status);
        this.denied?.encode(xdr);
    }
}
exports.Nfsv4LocktResponse = Nfsv4LocktResponse;
class Nfsv4LockuRequest {
    constructor(locktype, seqid, lockStateid, offset, length) {
        this.locktype = locktype;
        this.seqid = seqid;
        this.lockStateid = lockStateid;
        this.offset = offset;
        this.length = length;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(14);
        xdr.writeUnsignedInt(this.locktype);
        xdr.writeUnsignedInt(this.seqid);
        this.lockStateid.encode(xdr);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedHyper(this.length);
    }
}
exports.Nfsv4LockuRequest = Nfsv4LockuRequest;
class Nfsv4LockuResOk {
    constructor(lockStateid) {
        this.lockStateid = lockStateid;
    }
    encode(xdr) {
        this.lockStateid.encode(xdr);
    }
}
exports.Nfsv4LockuResOk = Nfsv4LockuResOk;
class Nfsv4LockuResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(14);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4LockuResponse = Nfsv4LockuResponse;
class Nfsv4LookupRequest {
    constructor(objname) {
        this.objname = objname;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(15);
        xdr.writeStr(this.objname);
    }
}
exports.Nfsv4LookupRequest = Nfsv4LookupRequest;
class Nfsv4LookupResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(15);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4LookupResponse = Nfsv4LookupResponse;
class Nfsv4LookuppRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(16);
    }
}
exports.Nfsv4LookuppRequest = Nfsv4LookuppRequest;
class Nfsv4LookuppResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(16);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4LookuppResponse = Nfsv4LookuppResponse;
class Nfsv4NverifyRequest {
    constructor(objAttributes) {
        this.objAttributes = objAttributes;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(17);
        this.objAttributes.encode(xdr);
    }
}
exports.Nfsv4NverifyRequest = Nfsv4NverifyRequest;
class Nfsv4NverifyResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(17);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4NverifyResponse = Nfsv4NverifyResponse;
class Nfsv4OpenRequest {
    constructor(seqid, shareAccess, shareDeny, owner, openhow, claim) {
        this.seqid = seqid;
        this.shareAccess = shareAccess;
        this.shareDeny = shareDeny;
        this.owner = owner;
        this.openhow = openhow;
        this.claim = claim;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(18);
        xdr.writeUnsignedInt(this.seqid);
        xdr.writeUnsignedInt(this.shareAccess);
        xdr.writeUnsignedInt(this.shareDeny);
        this.owner.encode(xdr);
        this.openhow.encode(xdr);
        this.claim.encode(xdr);
    }
}
exports.Nfsv4OpenRequest = Nfsv4OpenRequest;
class Nfsv4OpenResOk {
    constructor(stateid, cinfo, rflags, attrset, delegation) {
        this.stateid = stateid;
        this.cinfo = cinfo;
        this.rflags = rflags;
        this.attrset = attrset;
        this.delegation = delegation;
    }
    encode(xdr) {
        this.stateid.encode(xdr);
        this.cinfo.encode(xdr);
        xdr.writeUnsignedInt(this.rflags);
        this.attrset.encode(xdr);
        this.delegation.encode(xdr);
    }
}
exports.Nfsv4OpenResOk = Nfsv4OpenResOk;
class Nfsv4OpenResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(18);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4OpenResponse = Nfsv4OpenResponse;
class Nfsv4OpenattrRequest {
    constructor(createdir) {
        this.createdir = createdir;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(19);
        xdr.writeBoolean(this.createdir);
    }
}
exports.Nfsv4OpenattrRequest = Nfsv4OpenattrRequest;
class Nfsv4OpenattrResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(19);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4OpenattrResponse = Nfsv4OpenattrResponse;
class Nfsv4OpenConfirmRequest {
    constructor(openStateid, seqid) {
        this.openStateid = openStateid;
        this.seqid = seqid;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(20);
        this.openStateid.encode(xdr);
        xdr.writeUnsignedInt(this.seqid);
    }
}
exports.Nfsv4OpenConfirmRequest = Nfsv4OpenConfirmRequest;
class Nfsv4OpenConfirmResOk {
    constructor(openStateid) {
        this.openStateid = openStateid;
    }
    encode(xdr) {
        this.openStateid.encode(xdr);
    }
}
exports.Nfsv4OpenConfirmResOk = Nfsv4OpenConfirmResOk;
class Nfsv4OpenConfirmResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(20);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4OpenConfirmResponse = Nfsv4OpenConfirmResponse;
class Nfsv4OpenDowngradeRequest {
    constructor(openStateid, seqid, shareAccess, shareDeny) {
        this.openStateid = openStateid;
        this.seqid = seqid;
        this.shareAccess = shareAccess;
        this.shareDeny = shareDeny;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(21);
        this.openStateid.encode(xdr);
        xdr.writeUnsignedInt(this.seqid);
        xdr.writeUnsignedInt(this.shareAccess);
        xdr.writeUnsignedInt(this.shareDeny);
    }
}
exports.Nfsv4OpenDowngradeRequest = Nfsv4OpenDowngradeRequest;
class Nfsv4OpenDowngradeResOk {
    constructor(openStateid) {
        this.openStateid = openStateid;
    }
    encode(xdr) {
        this.openStateid.encode(xdr);
    }
}
exports.Nfsv4OpenDowngradeResOk = Nfsv4OpenDowngradeResOk;
class Nfsv4OpenDowngradeResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(21);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4OpenDowngradeResponse = Nfsv4OpenDowngradeResponse;
class Nfsv4PutfhRequest {
    constructor(object) {
        this.object = object;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(22);
        this.object.encode(xdr);
    }
}
exports.Nfsv4PutfhRequest = Nfsv4PutfhRequest;
class Nfsv4PutfhResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(22);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4PutfhResponse = Nfsv4PutfhResponse;
class Nfsv4PutpubfhRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(23);
    }
}
exports.Nfsv4PutpubfhRequest = Nfsv4PutpubfhRequest;
class Nfsv4PutpubfhResponse {
    static decode(xdr) {
        const status = xdr.readUnsignedInt();
        return new Nfsv4PutpubfhResponse(status);
    }
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(23);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4PutpubfhResponse = Nfsv4PutpubfhResponse;
class Nfsv4PutrootfhRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(24);
    }
}
exports.Nfsv4PutrootfhRequest = Nfsv4PutrootfhRequest;
class Nfsv4PutrootfhResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(24);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4PutrootfhResponse = Nfsv4PutrootfhResponse;
class Nfsv4ReadRequest {
    constructor(stateid, offset, count) {
        this.stateid = stateid;
        this.offset = offset;
        this.count = count;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(25);
        this.stateid.encode(xdr);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedInt(this.count);
    }
}
exports.Nfsv4ReadRequest = Nfsv4ReadRequest;
class Nfsv4ReadResOk {
    constructor(eof, data) {
        this.eof = eof;
        this.data = data;
    }
    encode(xdr) {
        xdr.writeBoolean(this.eof);
        xdr.writeVarlenOpaque(this.data);
    }
}
exports.Nfsv4ReadResOk = Nfsv4ReadResOk;
class Nfsv4ReadResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(25);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4ReadResponse = Nfsv4ReadResponse;
class Nfsv4ReaddirRequest {
    constructor(cookie, cookieverf, dircount, maxcount, attrRequest) {
        this.cookie = cookie;
        this.cookieverf = cookieverf;
        this.dircount = dircount;
        this.maxcount = maxcount;
        this.attrRequest = attrRequest;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(26);
        xdr.writeUnsignedHyper(this.cookie);
        this.cookieverf.encode(xdr);
        xdr.writeUnsignedInt(this.dircount);
        xdr.writeUnsignedInt(this.maxcount);
        this.attrRequest.encode(xdr);
    }
}
exports.Nfsv4ReaddirRequest = Nfsv4ReaddirRequest;
class Nfsv4ReaddirResOk {
    constructor(cookieverf, entries, eof) {
        this.cookieverf = cookieverf;
        this.entries = entries;
        this.eof = eof;
    }
    encode(xdr) {
        this.cookieverf.encode(xdr);
        const entries = this.entries;
        const length = entries.length;
        for (let i = 0; i < length; i++) {
            const entry = entries[i];
            xdr.writeBoolean(true);
            entry.encode(xdr);
        }
        xdr.writeBoolean(false);
        xdr.writeBoolean(this.eof);
    }
}
exports.Nfsv4ReaddirResOk = Nfsv4ReaddirResOk;
class Nfsv4ReaddirResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(26);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4ReaddirResponse = Nfsv4ReaddirResponse;
class Nfsv4ReadlinkRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(27);
    }
}
exports.Nfsv4ReadlinkRequest = Nfsv4ReadlinkRequest;
class Nfsv4ReadlinkResOk {
    constructor(link) {
        this.link = link;
    }
    encode(xdr) {
        xdr.writeStr(this.link);
    }
}
exports.Nfsv4ReadlinkResOk = Nfsv4ReadlinkResOk;
class Nfsv4ReadlinkResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(27);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4ReadlinkResponse = Nfsv4ReadlinkResponse;
class Nfsv4RemoveRequest {
    constructor(target) {
        this.target = target;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(28);
        xdr.writeStr(this.target);
    }
}
exports.Nfsv4RemoveRequest = Nfsv4RemoveRequest;
class Nfsv4RemoveResOk {
    constructor(cinfo) {
        this.cinfo = cinfo;
    }
    encode(xdr) {
        this.cinfo.encode(xdr);
    }
}
exports.Nfsv4RemoveResOk = Nfsv4RemoveResOk;
class Nfsv4RemoveResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(28);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4RemoveResponse = Nfsv4RemoveResponse;
class Nfsv4RenameRequest {
    constructor(oldname, newname) {
        this.oldname = oldname;
        this.newname = newname;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(29);
        xdr.writeStr(this.oldname);
        xdr.writeStr(this.newname);
    }
}
exports.Nfsv4RenameRequest = Nfsv4RenameRequest;
class Nfsv4RenameResOk {
    constructor(sourceCinfo, targetCinfo) {
        this.sourceCinfo = sourceCinfo;
        this.targetCinfo = targetCinfo;
    }
    encode(xdr) {
        this.sourceCinfo.encode(xdr);
        this.targetCinfo.encode(xdr);
    }
}
exports.Nfsv4RenameResOk = Nfsv4RenameResOk;
class Nfsv4RenameResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(29);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4RenameResponse = Nfsv4RenameResponse;
class Nfsv4RenewRequest {
    constructor(clientid) {
        this.clientid = clientid;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(30);
        xdr.writeUnsignedHyper(this.clientid);
    }
}
exports.Nfsv4RenewRequest = Nfsv4RenewRequest;
class Nfsv4RenewResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(30);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4RenewResponse = Nfsv4RenewResponse;
class Nfsv4RestorefhRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(31);
    }
}
exports.Nfsv4RestorefhRequest = Nfsv4RestorefhRequest;
class Nfsv4RestorefhResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(31);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4RestorefhResponse = Nfsv4RestorefhResponse;
class Nfsv4SavefhRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(32);
    }
}
exports.Nfsv4SavefhRequest = Nfsv4SavefhRequest;
class Nfsv4SavefhResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(32);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4SavefhResponse = Nfsv4SavefhResponse;
class Nfsv4SecinfoRequest {
    constructor(name) {
        this.name = name;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(33);
        xdr.writeStr(this.name);
    }
}
exports.Nfsv4SecinfoRequest = Nfsv4SecinfoRequest;
class Nfsv4SecinfoResOk {
    constructor(flavors) {
        this.flavors = flavors;
    }
    encode(xdr) {
        const flavors = this.flavors;
        const len = flavors.length;
        xdr.writeUnsignedInt(len);
        for (let i = 0; i < len; i++)
            flavors[i].encode(xdr);
    }
}
exports.Nfsv4SecinfoResOk = Nfsv4SecinfoResOk;
class Nfsv4SecinfoResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(33);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok)
            this.resok.encode(xdr);
    }
}
exports.Nfsv4SecinfoResponse = Nfsv4SecinfoResponse;
class Nfsv4SetattrRequest {
    constructor(stateid, objAttributes) {
        this.stateid = stateid;
        this.objAttributes = objAttributes;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(34);
        this.stateid.encode(xdr);
        this.objAttributes.encode(xdr);
    }
}
exports.Nfsv4SetattrRequest = Nfsv4SetattrRequest;
class Nfsv4SetattrResOk {
    constructor(attrsset) {
        this.attrsset = attrsset;
    }
    encode(xdr) {
        this.attrsset.encode(xdr);
    }
}
exports.Nfsv4SetattrResOk = Nfsv4SetattrResOk;
class Nfsv4SetattrResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(34);
        xdr.writeUnsignedInt(this.status);
        this.resok?.encode(xdr);
    }
}
exports.Nfsv4SetattrResponse = Nfsv4SetattrResponse;
class Nfsv4SetclientidRequest {
    constructor(client, callback, callbackIdent) {
        this.client = client;
        this.callback = callback;
        this.callbackIdent = callbackIdent;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(35);
        this.client.encode(xdr);
        this.callback.encode(xdr);
        xdr.writeUnsignedInt(this.callbackIdent);
    }
}
exports.Nfsv4SetclientidRequest = Nfsv4SetclientidRequest;
class Nfsv4SetclientidResOk {
    constructor(clientid, setclientidConfirm) {
        this.clientid = clientid;
        this.setclientidConfirm = setclientidConfirm;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.clientid);
        this.setclientidConfirm.encode(xdr);
    }
}
exports.Nfsv4SetclientidResOk = Nfsv4SetclientidResOk;
class Nfsv4SetclientidResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(35);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0)
            this.resok?.encode(xdr);
    }
}
exports.Nfsv4SetclientidResponse = Nfsv4SetclientidResponse;
class Nfsv4SetclientidConfirmRequest {
    constructor(clientid, setclientidConfirm) {
        this.clientid = clientid;
        this.setclientidConfirm = setclientidConfirm;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(36);
        xdr.writeUnsignedHyper(this.clientid);
        this.setclientidConfirm.encode(xdr);
    }
}
exports.Nfsv4SetclientidConfirmRequest = Nfsv4SetclientidConfirmRequest;
class Nfsv4SetclientidConfirmResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(36);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4SetclientidConfirmResponse = Nfsv4SetclientidConfirmResponse;
class Nfsv4VerifyRequest {
    constructor(objAttributes) {
        this.objAttributes = objAttributes;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(37);
        this.objAttributes.encode(xdr);
    }
}
exports.Nfsv4VerifyRequest = Nfsv4VerifyRequest;
class Nfsv4VerifyResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(37);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4VerifyResponse = Nfsv4VerifyResponse;
class Nfsv4WriteRequest {
    constructor(stateid, offset, stable, data) {
        this.stateid = stateid;
        this.offset = offset;
        this.stable = stable;
        this.data = data;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(38);
        this.stateid.encode(xdr);
        xdr.writeUnsignedHyper(this.offset);
        xdr.writeUnsignedInt(this.stable);
        xdr.writeVarlenOpaque(this.data);
    }
}
exports.Nfsv4WriteRequest = Nfsv4WriteRequest;
class Nfsv4WriteResOk {
    constructor(count, committed, writeverf) {
        this.count = count;
        this.committed = committed;
        this.writeverf = writeverf;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.count);
        xdr.writeUnsignedInt(this.committed);
        this.writeverf.encode(xdr);
    }
}
exports.Nfsv4WriteResOk = Nfsv4WriteResOk;
class Nfsv4WriteResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(38);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok)
            this.resok.encode(xdr);
    }
}
exports.Nfsv4WriteResponse = Nfsv4WriteResponse;
class Nfsv4ReleaseLockOwnerRequest {
    constructor(lockOwner) {
        this.lockOwner = lockOwner;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(39);
        this.lockOwner.encode(xdr);
    }
}
exports.Nfsv4ReleaseLockOwnerRequest = Nfsv4ReleaseLockOwnerRequest;
class Nfsv4ReleaseLockOwnerResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(39);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4ReleaseLockOwnerResponse = Nfsv4ReleaseLockOwnerResponse;
class Nfsv4IllegalRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(10044);
    }
}
exports.Nfsv4IllegalRequest = Nfsv4IllegalRequest;
class Nfsv4IllegalResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(10044);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4IllegalResponse = Nfsv4IllegalResponse;
class Nfsv4CompoundRequest {
    constructor(tag, minorversion, argarray) {
        this.tag = tag;
        this.minorversion = minorversion;
        this.argarray = argarray;
    }
    encode(xdr) {
        xdr.writeStr(this.tag);
        xdr.writeUnsignedInt(this.minorversion);
        const argarray = this.argarray;
        const len = argarray.length;
        xdr.writeUnsignedInt(len);
        for (let i = 0; i < len; i++)
            argarray[i].encode(xdr);
    }
}
exports.Nfsv4CompoundRequest = Nfsv4CompoundRequest;
class Nfsv4CompoundResponse {
    constructor(status, tag, resarray) {
        this.status = status;
        this.tag = tag;
        this.resarray = resarray;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.status);
        xdr.writeStr(this.tag);
        const resarray = this.resarray;
        const len = resarray.length;
        xdr.writeUnsignedInt(len);
        for (let i = 0; i < len; i++)
            resarray[i].encode(xdr);
    }
}
exports.Nfsv4CompoundResponse = Nfsv4CompoundResponse;
class Nfsv4CbGetattrRequest {
    constructor(fh, attrRequest) {
        this.fh = fh;
        this.attrRequest = attrRequest;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(3);
        this.fh.encode(xdr);
        this.attrRequest.encode(xdr);
    }
}
exports.Nfsv4CbGetattrRequest = Nfsv4CbGetattrRequest;
class Nfsv4CbGetattrResOk {
    constructor(objAttributes) {
        this.objAttributes = objAttributes;
    }
    encode(xdr) {
        this.objAttributes.encode(xdr);
    }
}
exports.Nfsv4CbGetattrResOk = Nfsv4CbGetattrResOk;
class Nfsv4CbGetattrResponse {
    constructor(status, resok) {
        this.status = status;
        this.resok = resok;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(3);
        xdr.writeUnsignedInt(this.status);
        if (this.status === 0 && this.resok) {
            this.resok.encode(xdr);
        }
    }
}
exports.Nfsv4CbGetattrResponse = Nfsv4CbGetattrResponse;
class Nfsv4CbRecallRequest {
    constructor(stateid, truncate, fh) {
        this.stateid = stateid;
        this.truncate = truncate;
        this.fh = fh;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(4);
        this.stateid.encode(xdr);
        xdr.writeBoolean(this.truncate);
        this.fh.encode(xdr);
    }
}
exports.Nfsv4CbRecallRequest = Nfsv4CbRecallRequest;
class Nfsv4CbRecallResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(4);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4CbRecallResponse = Nfsv4CbRecallResponse;
class Nfsv4CbIllegalRequest {
    encode(xdr) {
        xdr.writeUnsignedInt(10044);
    }
}
exports.Nfsv4CbIllegalRequest = Nfsv4CbIllegalRequest;
class Nfsv4CbIllegalResponse {
    constructor(status) {
        this.status = status;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(10044);
        xdr.writeUnsignedInt(this.status);
    }
}
exports.Nfsv4CbIllegalResponse = Nfsv4CbIllegalResponse;
class Nfsv4CbCompoundRequest {
    constructor(tag, minorversion, callbackIdent, argarray) {
        this.tag = tag;
        this.minorversion = minorversion;
        this.callbackIdent = callbackIdent;
        this.argarray = argarray;
    }
    encode(xdr) {
        xdr.writeStr(this.tag);
        xdr.writeUnsignedInt(this.minorversion);
        xdr.writeUnsignedInt(this.callbackIdent);
        const argarray = this.argarray;
        const len = argarray.length;
        xdr.writeUnsignedInt(len);
        for (let i = 0; i < len; i++)
            argarray[i].encode(xdr);
    }
}
exports.Nfsv4CbCompoundRequest = Nfsv4CbCompoundRequest;
class Nfsv4CbCompoundResponse {
    constructor(status, tag, resarray) {
        this.status = status;
        this.tag = tag;
        this.resarray = resarray;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.status);
        xdr.writeStr(this.tag);
        const resarray = this.resarray;
        const len = resarray.length;
        xdr.writeUnsignedInt(len);
        for (let i = 0; i < len; i++)
            resarray[i].encode(xdr);
    }
}
exports.Nfsv4CbCompoundResponse = Nfsv4CbCompoundResponse;
//# sourceMappingURL=messages.js.map