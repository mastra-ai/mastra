"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4Decoder = void 0;
const tslib_1 = require("tslib");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrDecoder_1 = require("../../xdr/XdrDecoder");
const errors_1 = require("./errors");
const msg = tslib_1.__importStar(require("./messages"));
const structs = tslib_1.__importStar(require("./structs"));
class Nfsv4Decoder {
    constructor(reader = new Reader_1.Reader()) {
        this.xdr = new XdrDecoder_1.XdrDecoder(reader);
    }
    decodeCompound(reader, isRequest) {
        if (isRequest) {
            return this.decodeCompoundRequest(reader);
        }
        else {
            return this.decodeCompoundResponse(reader);
        }
    }
    decodeCompoundRequest(reader) {
        const xdr = this.xdr;
        xdr.reader = reader;
        const tag = xdr.readString();
        const minorversion = xdr.readUnsignedInt();
        const argarray = [];
        const count = xdr.readUnsignedInt();
        for (let i = 0; i < count; i++) {
            const op = xdr.readUnsignedInt();
            const request = this.decodeRequest(op);
            if (request)
                argarray.push(request);
        }
        return new msg.Nfsv4CompoundRequest(tag, minorversion, argarray);
    }
    decodeCompoundResponse(reader) {
        const xdr = this.xdr;
        xdr.reader = reader;
        const status = xdr.readUnsignedInt();
        const tag = xdr.readString();
        const resarray = [];
        const count = xdr.readUnsignedInt();
        for (let i = 0; i < count; i++) {
            const op = xdr.readUnsignedInt();
            const response = this.decodeResponse(op);
            if (response)
                resarray.push(response);
        }
        return new msg.Nfsv4CompoundResponse(status, tag, resarray);
    }
    decodeRequest(op) {
        const xdr = this.xdr;
        switch (op) {
            case 3:
                return msg.Nfsv4AccessRequest.decode(xdr);
            case 4:
                return msg.Nfsv4CloseRequest.decode(xdr);
            case 5:
                return msg.Nfsv4CommitRequest.decode(xdr);
            case 6:
                return this.decodeCreateRequest();
            case 7:
                return msg.Nfsv4DelegpurgeRequest.decode(xdr);
            case 8:
                return msg.Nfsv4DelegreturnRequest.decode(xdr);
            case 9:
                return this.decodeGetattrRequest();
            case 10:
                return this.decodeGetfhRequest();
            case 11:
                return this.decodeLinkRequest();
            case 12:
                return this.decodeLockRequest();
            case 13:
                return this.decodeLocktRequest();
            case 14:
                return this.decodeLockuRequest();
            case 15:
                return this.decodeLookupRequest();
            case 16:
                return this.decodeLookuppRequest();
            case 17:
                return this.decodeNverifyRequest();
            case 18:
                return this.decodeOpenRequest();
            case 19:
                return this.decodeOpenattrRequest();
            case 20:
                return this.decodeOpenConfirmRequest();
            case 21:
                return this.decodeOpenDowngradeRequest();
            case 22:
                return this.decodePutfhRequest();
            case 23:
                return new msg.Nfsv4PutpubfhRequest();
            case 24:
                return new msg.Nfsv4PutrootfhRequest();
            case 25:
                return this.decodeReadRequest();
            case 26:
                return this.decodeReaddirRequest();
            case 27:
                return this.decodeReadlinkRequest();
            case 28:
                return this.decodeRemoveRequest();
            case 29:
                return this.decodeRenameRequest();
            case 30:
                return this.decodeRenewRequest();
            case 31:
                return this.decodeRestorefhRequest();
            case 32:
                return new msg.Nfsv4SavefhRequest();
            case 33:
                return this.decodeSecinfoRequest();
            case 34:
                return this.decodeSetattrRequest();
            case 35:
                return this.decodeSetclientidRequest();
            case 36:
                return this.decodeSetclientidConfirmRequest();
            case 37:
                return this.decodeVerifyRequest();
            case 38:
                return this.decodeWriteRequest();
            case 39:
                return this.decodeReleaseLockOwnerRequest();
            case 10044:
                return this.decodeIllegalRequest();
            default:
                return this.decodeIllegalRequest();
        }
    }
    decodeResponse(op) {
        const xdr = this.xdr;
        switch (op) {
            case 3:
                return this.decodeAccessResponse();
            case 4:
                return this.decodeCloseResponse();
            case 5:
                return this.decodeCommitResponse();
            case 6:
                return this.decodeCreateResponse();
            case 7:
                return this.decodeDelegpurgeResponse();
            case 8:
                return this.decodeDelegreturnResponse();
            case 9:
                return this.decodeGetattrResponse();
            case 10:
                return this.decodeGetfhResponse();
            case 11:
                return this.decodeLinkResponse();
            case 12:
                return this.decodeLockResponse();
            case 13:
                return this.decodeLocktResponse();
            case 14:
                return this.decodeLockuResponse();
            case 15:
                return this.decodeLookupResponse();
            case 16:
                return this.decodeLookuppResponse();
            case 17:
                return this.decodeNverifyResponse();
            case 18:
                return this.decodeOpenResponse();
            case 19:
                return this.decodeOpenattrResponse();
            case 20:
                return this.decodeOpenConfirmResponse();
            case 21:
                return this.decodeOpenDowngradeResponse();
            case 22:
                return this.decodePutfhResponse();
            case 23:
                return msg.Nfsv4PutpubfhResponse.decode(xdr);
            case 24:
                return this.decodePutrootfhResponse();
            case 25:
                return this.decodeReadResponse();
            case 26:
                return this.decodeReaddirResponse();
            case 27:
                return this.decodeReadlinkResponse();
            case 28:
                return this.decodeRemoveResponse();
            case 29:
                return this.decodeRenameResponse();
            case 30:
                return this.decodeRenewResponse();
            case 31:
                return this.decodeRestorefhResponse();
            case 32:
                return this.decodeSavefhResponse();
            case 33:
                return this.decodeSecinfoResponse();
            case 34:
                return this.decodeSetattrResponse();
            case 35:
                return this.decodeSetclientidResponse();
            case 36:
                return this.decodeSetclientidConfirmResponse();
            case 37:
                return this.decodeVerifyResponse();
            case 38:
                return this.decodeWriteResponse();
            case 39:
                return this.decodeReleaseLockOwnerResponse();
            case 10044:
                return this.decodeIllegalResponse();
            default:
                return this.decodeIllegalResponse();
        }
    }
    readFh() {
        const data = this.xdr.readVarlenOpaque();
        return new structs.Nfsv4Fh(data);
    }
    readVerifier() {
        const data = this.xdr.readOpaque(8);
        return new structs.Nfsv4Verifier(data);
    }
    readStateid() {
        return structs.Nfsv4Stateid.decode(this.xdr);
    }
    readBitmap() {
        const xdr = this.xdr;
        const count = xdr.readUnsignedInt();
        if (count > 8)
            throw 10036;
        const mask = [];
        for (let i = 0; i < count; i++)
            mask.push(xdr.readUnsignedInt());
        return new structs.Nfsv4Bitmap(mask);
    }
    readFattr() {
        const attrmask = this.readBitmap();
        const attrVals = this.xdr.readVarlenOpaque();
        return new structs.Nfsv4Fattr(attrmask, attrVals);
    }
    readChangeInfo() {
        const xdr = this.xdr;
        const atomic = xdr.readBoolean();
        const before = xdr.readUnsignedHyper();
        const after = xdr.readUnsignedHyper();
        return new structs.Nfsv4ChangeInfo(atomic, before, after);
    }
    readClientAddr() {
        const xdr = this.xdr;
        const rNetid = xdr.readString();
        const rAddr = xdr.readString();
        return new structs.Nfsv4ClientAddr(rNetid, rAddr);
    }
    readCbClient() {
        const cbProgram = this.xdr.readUnsignedInt();
        const cbLocation = this.readClientAddr();
        return new structs.Nfsv4CbClient(cbProgram, cbLocation);
    }
    readClientId() {
        const verifier = this.readVerifier();
        const id = this.xdr.readVarlenOpaque();
        return new structs.Nfsv4ClientId(verifier, id);
    }
    readOpenOwner() {
        const xdr = this.xdr;
        const clientid = xdr.readUnsignedHyper();
        const owner = xdr.readVarlenOpaque();
        return new structs.Nfsv4OpenOwner(clientid, owner);
    }
    readLockOwner() {
        const xdr = this.xdr;
        const clientid = xdr.readUnsignedHyper();
        const owner = xdr.readVarlenOpaque();
        return new structs.Nfsv4LockOwner(clientid, owner);
    }
    readOpenToLockOwner() {
        const xdr = this.xdr;
        const openSeqid = xdr.readUnsignedInt();
        const openStateid = this.readStateid();
        const lockSeqid = xdr.readUnsignedInt();
        const lockOwner = this.readLockOwner();
        return new structs.Nfsv4OpenToLockOwner(openSeqid, openStateid, lockSeqid, lockOwner);
    }
    readLockOwnerInfo() {
        const xdr = this.xdr;
        const newLockOwner = xdr.readBoolean();
        if (newLockOwner) {
            const openToLockOwner = this.readOpenToLockOwner();
            return new structs.Nfsv4LockOwnerInfo(true, new structs.Nfsv4LockNewOwner(openToLockOwner));
        }
        else {
            const lockStateid = this.readStateid();
            const lockSeqid = xdr.readUnsignedInt();
            return new structs.Nfsv4LockOwnerInfo(false, new structs.Nfsv4LockExistingOwner(lockStateid, lockSeqid));
        }
    }
    readOpenClaim() {
        const xdr = this.xdr;
        const claimType = xdr.readUnsignedInt();
        switch (claimType) {
            case 0: {
                const file = xdr.readString();
                return new structs.Nfsv4OpenClaim(claimType, new structs.Nfsv4OpenClaimNull(file));
            }
            case 1: {
                const delegateType = xdr.readUnsignedInt();
                return new structs.Nfsv4OpenClaim(claimType, new structs.Nfsv4OpenClaimPrevious(delegateType));
            }
            case 2: {
                const delegateStateid = this.readStateid();
                const file = xdr.readString();
                return new structs.Nfsv4OpenClaim(claimType, new structs.Nfsv4OpenClaimDelegateCur(delegateStateid, file));
            }
            case 3: {
                const file = xdr.readString();
                return new structs.Nfsv4OpenClaim(claimType, new structs.Nfsv4OpenClaimDelegatePrev(file));
            }
            default:
                throw new errors_1.Nfsv4DecodingError(`Unknown open claim type: ${claimType}`);
        }
    }
    readOpenHow() {
        const xdr = this.xdr;
        const opentype = xdr.readUnsignedInt();
        if (opentype === 0)
            return new structs.Nfsv4OpenHow(opentype);
        const mode = xdr.readUnsignedInt();
        switch (mode) {
            case 0:
            case 1: {
                const createattrs = this.readFattr();
                return new structs.Nfsv4OpenHow(opentype, new structs.Nfsv4CreateHow(mode, new structs.Nfsv4CreateAttrs(createattrs)));
            }
            case 2: {
                const createverf = this.readVerifier();
                return new structs.Nfsv4OpenHow(opentype, new structs.Nfsv4CreateHow(mode, new structs.Nfsv4CreateVerf(createverf)));
            }
            default:
                throw new errors_1.Nfsv4DecodingError(`Unknown create mode: ${mode}`);
        }
    }
    readOpenDelegation() {
        const xdr = this.xdr;
        const delegationType = xdr.readUnsignedInt();
        switch (delegationType) {
            case 0:
                return new structs.Nfsv4OpenDelegation(delegationType);
            case 1: {
                const stateid = this.readStateid();
                const recall = xdr.readBoolean();
                const aceCount = xdr.readUnsignedInt();
                const permissions = [];
                for (let i = 0; i < aceCount; i++) {
                    permissions.push(this.readAce());
                }
                return new structs.Nfsv4OpenDelegation(delegationType, new structs.Nfsv4OpenReadDelegation(stateid, recall, permissions));
            }
            case 2: {
                const stateid = this.readStateid();
                const recall = xdr.readBoolean();
                const spaceLimit = xdr.readUnsignedHyper();
                const aceCount = xdr.readUnsignedInt();
                const permissions = [];
                for (let i = 0; i < aceCount; i++) {
                    permissions.push(this.readAce());
                }
                return new structs.Nfsv4OpenDelegation(delegationType, new structs.Nfsv4OpenWriteDelegation(stateid, recall, spaceLimit, permissions));
            }
            default:
                throw new errors_1.Nfsv4DecodingError(`Unknown delegation type: ${delegationType}`);
        }
    }
    readAce() {
        const xdr = this.xdr;
        const type = xdr.readUnsignedInt();
        const flag = xdr.readUnsignedInt();
        const accessMask = xdr.readUnsignedInt();
        const who = xdr.readString();
        return new structs.Nfsv4Ace(type, flag, accessMask, who);
    }
    readSecInfoFlavor() {
        const xdr = this.xdr;
        const flavor = xdr.readUnsignedInt();
        if (flavor === 6) {
            const oid = xdr.readVarlenOpaque();
            const qop = xdr.readUnsignedInt();
            const service = xdr.readUnsignedInt();
            const flavorInfo = new structs.Nfsv4RpcSecGssInfo(oid, qop, service);
            return new structs.Nfsv4SecInfoFlavor(flavor, flavorInfo);
        }
        return new structs.Nfsv4SecInfoFlavor(flavor);
    }
    decodeAccessResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const supported = xdr.readUnsignedInt();
            const access = xdr.readUnsignedInt();
            return new msg.Nfsv4AccessResponse(status, new msg.Nfsv4AccessResOk(supported, access));
        }
        return new msg.Nfsv4AccessResponse(status);
    }
    decodeCloseRequest() {
        const xdr = this.xdr;
        const seqid = xdr.readUnsignedInt();
        const openStateid = this.readStateid();
        return new msg.Nfsv4CloseRequest(seqid, openStateid);
    }
    decodeCloseResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const openStateid = this.readStateid();
            return new msg.Nfsv4CloseResponse(status, new msg.Nfsv4CloseResOk(openStateid));
        }
        return new msg.Nfsv4CloseResponse(status);
    }
    decodeCommitResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const writeverf = this.readVerifier();
            return new msg.Nfsv4CommitResponse(status, new msg.Nfsv4CommitResOk(writeverf));
        }
        return new msg.Nfsv4CommitResponse(status);
    }
    decodeCreateRequest() {
        const xdr = this.xdr;
        const type = xdr.readUnsignedInt();
        let objtype;
        switch (type) {
            case 5: {
                const linkdata = xdr.readString();
                objtype = new structs.Nfsv4CreateType(type, new structs.Nfsv4CreateTypeLink(linkdata));
                break;
            }
            case 3:
            case 4: {
                const specdata1 = xdr.readUnsignedInt();
                const specdata2 = xdr.readUnsignedInt();
                const devdata = new structs.Nfsv4SpecData(specdata1, specdata2);
                objtype = new structs.Nfsv4CreateType(type, new structs.Nfsv4CreateTypeDevice(devdata));
                break;
            }
            default: {
                objtype = new structs.Nfsv4CreateType(type, new structs.Nfsv4CreateTypeVoid());
                break;
            }
        }
        const objname = xdr.readString();
        const createattrs = this.readFattr();
        return new msg.Nfsv4CreateRequest(objtype, objname, createattrs);
    }
    decodeCreateResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const cinfo = this.readChangeInfo();
            const attrset = this.readBitmap();
            return new msg.Nfsv4CreateResponse(status, new msg.Nfsv4CreateResOk(cinfo, attrset));
        }
        return new msg.Nfsv4CreateResponse(status);
    }
    decodeDelegpurgeResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4DelegpurgeResponse(status);
    }
    decodeDelegreturnResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4DelegreturnResponse(status);
    }
    decodeGetattrRequest() {
        const attrRequest = this.readBitmap();
        return new msg.Nfsv4GetattrRequest(attrRequest);
    }
    decodeGetattrResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const objAttributes = this.readFattr();
            return new msg.Nfsv4GetattrResponse(status, new msg.Nfsv4GetattrResOk(objAttributes));
        }
        return new msg.Nfsv4GetattrResponse(status);
    }
    decodeGetfhRequest() {
        return new msg.Nfsv4GetfhRequest();
    }
    decodeGetfhResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const object = this.readFh();
            return new msg.Nfsv4GetfhResponse(status, new msg.Nfsv4GetfhResOk(object));
        }
        return new msg.Nfsv4GetfhResponse(status);
    }
    decodeLinkRequest() {
        const newname = this.xdr.readString();
        return new msg.Nfsv4LinkRequest(newname);
    }
    decodeLinkResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const cinfo = this.readChangeInfo();
            return new msg.Nfsv4LinkResponse(status, new msg.Nfsv4LinkResOk(cinfo));
        }
        return new msg.Nfsv4LinkResponse(status);
    }
    decodeLockRequest() {
        const xdr = this.xdr;
        const locktype = xdr.readUnsignedInt();
        const reclaim = xdr.readBoolean();
        const offset = xdr.readUnsignedHyper();
        const length = xdr.readUnsignedHyper();
        const locker = this.readLockOwnerInfo();
        return new msg.Nfsv4LockRequest(locktype, reclaim, offset, length, locker);
    }
    decodeLockResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const lockStateid = this.readStateid();
            return new msg.Nfsv4LockResponse(status, new msg.Nfsv4LockResOk(lockStateid));
        }
        else if (status === 10010) {
            const offset = xdr.readUnsignedHyper();
            const length = xdr.readUnsignedHyper();
            const locktype = xdr.readUnsignedInt();
            const owner = this.readLockOwner();
            return new msg.Nfsv4LockResponse(status, undefined, new msg.Nfsv4LockResDenied(offset, length, locktype, owner));
        }
        return new msg.Nfsv4LockResponse(status);
    }
    decodeLocktRequest() {
        const xdr = this.xdr;
        const locktype = xdr.readUnsignedInt();
        const offset = xdr.readUnsignedHyper();
        const length = xdr.readUnsignedHyper();
        const owner = this.readLockOwner();
        return new msg.Nfsv4LocktRequest(locktype, offset, length, owner);
    }
    decodeLocktResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 10010) {
            const offset = xdr.readUnsignedHyper();
            const length = xdr.readUnsignedHyper();
            const locktype = xdr.readUnsignedInt();
            const owner = this.readLockOwner();
            return new msg.Nfsv4LocktResponse(status, new msg.Nfsv4LocktResDenied(offset, length, locktype, owner));
        }
        return new msg.Nfsv4LocktResponse(status);
    }
    decodeLockuRequest() {
        const xdr = this.xdr;
        const locktype = xdr.readUnsignedInt();
        const seqid = xdr.readUnsignedInt();
        const lockStateid = this.readStateid();
        const offset = xdr.readUnsignedHyper();
        const length = xdr.readUnsignedHyper();
        return new msg.Nfsv4LockuRequest(locktype, seqid, lockStateid, offset, length);
    }
    decodeLockuResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const lockStateid = this.readStateid();
            return new msg.Nfsv4LockuResponse(status, new msg.Nfsv4LockuResOk(lockStateid));
        }
        return new msg.Nfsv4LockuResponse(status);
    }
    decodeLookupRequest() {
        const objname = this.xdr.readString();
        return new msg.Nfsv4LookupRequest(objname);
    }
    decodeLookupResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4LookupResponse(status);
    }
    decodeLookuppRequest() {
        return new msg.Nfsv4LookuppRequest();
    }
    decodeLookuppResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4LookuppResponse(status);
    }
    decodeNverifyRequest() {
        const objAttributes = this.readFattr();
        return new msg.Nfsv4NverifyRequest(objAttributes);
    }
    decodeNverifyResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4NverifyResponse(status);
    }
    decodeOpenRequest() {
        const xdr = this.xdr;
        const seqid = xdr.readUnsignedInt();
        const shareAccess = xdr.readUnsignedInt();
        const shareDeny = xdr.readUnsignedInt();
        const owner = this.readOpenOwner();
        const openhow = this.readOpenHow();
        const claim = this.readOpenClaim();
        return new msg.Nfsv4OpenRequest(seqid, shareAccess, shareDeny, owner, openhow, claim);
    }
    decodeOpenResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const stateid = this.readStateid();
            const cinfo = this.readChangeInfo();
            const rflags = xdr.readUnsignedInt();
            const attrset = this.readBitmap();
            const delegation = this.readOpenDelegation();
            return new msg.Nfsv4OpenResponse(status, new msg.Nfsv4OpenResOk(stateid, cinfo, rflags, attrset, delegation));
        }
        return new msg.Nfsv4OpenResponse(status);
    }
    decodeOpenattrRequest() {
        const createdir = this.xdr.readBoolean();
        return new msg.Nfsv4OpenattrRequest(createdir);
    }
    decodeOpenattrResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4OpenattrResponse(status);
    }
    decodeOpenConfirmRequest() {
        const openStateid = this.readStateid();
        const seqid = this.xdr.readUnsignedInt();
        return new msg.Nfsv4OpenConfirmRequest(openStateid, seqid);
    }
    decodeOpenConfirmResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const openStateid = this.readStateid();
            return new msg.Nfsv4OpenConfirmResponse(status, new msg.Nfsv4OpenConfirmResOk(openStateid));
        }
        return new msg.Nfsv4OpenConfirmResponse(status);
    }
    decodeOpenDowngradeRequest() {
        const xdr = this.xdr;
        const openStateid = this.readStateid();
        const seqid = xdr.readUnsignedInt();
        const shareAccess = xdr.readUnsignedInt();
        const shareDeny = xdr.readUnsignedInt();
        return new msg.Nfsv4OpenDowngradeRequest(openStateid, seqid, shareAccess, shareDeny);
    }
    decodeOpenDowngradeResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const openStateid = this.readStateid();
            return new msg.Nfsv4OpenDowngradeResponse(status, new msg.Nfsv4OpenDowngradeResOk(openStateid));
        }
        return new msg.Nfsv4OpenDowngradeResponse(status);
    }
    decodePutfhRequest() {
        const object = this.readFh();
        return new msg.Nfsv4PutfhRequest(object);
    }
    decodePutfhResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4PutfhResponse(status);
    }
    decodePutrootfhResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4PutrootfhResponse(status);
    }
    decodeReadRequest() {
        const xdr = this.xdr;
        const stateid = this.readStateid();
        const offset = xdr.readUnsignedHyper();
        const count = xdr.readUnsignedInt();
        return new msg.Nfsv4ReadRequest(stateid, offset, count);
    }
    decodeReadResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const eof = xdr.readBoolean();
            const data = xdr.readVarlenOpaque();
            return new msg.Nfsv4ReadResponse(status, new msg.Nfsv4ReadResOk(eof, data));
        }
        return new msg.Nfsv4ReadResponse(status);
    }
    decodeReaddirRequest() {
        const xdr = this.xdr;
        const cookie = xdr.readUnsignedHyper();
        const cookieverf = this.readVerifier();
        const dircount = xdr.readUnsignedInt();
        const maxcount = xdr.readUnsignedInt();
        const attrRequest = this.readBitmap();
        return new msg.Nfsv4ReaddirRequest(cookie, cookieverf, dircount, maxcount, attrRequest);
    }
    decodeReaddirResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const cookieverf = this.readVerifier();
            const entries = [];
            while (xdr.readBoolean()) {
                const cookie = xdr.readUnsignedHyper();
                const name = xdr.readString();
                const attrs = this.readFattr();
                entries.push(new structs.Nfsv4Entry(cookie, name, attrs));
            }
            const eof = xdr.readBoolean();
            return new msg.Nfsv4ReaddirResponse(status, new msg.Nfsv4ReaddirResOk(cookieverf, entries, eof));
        }
        return new msg.Nfsv4ReaddirResponse(status);
    }
    decodeReadlinkRequest() {
        return new msg.Nfsv4ReadlinkRequest();
    }
    decodeReadlinkResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const link = xdr.readString();
            return new msg.Nfsv4ReadlinkResponse(status, new msg.Nfsv4ReadlinkResOk(link));
        }
        return new msg.Nfsv4ReadlinkResponse(status);
    }
    decodeRemoveRequest() {
        const target = this.xdr.readString();
        return new msg.Nfsv4RemoveRequest(target);
    }
    decodeRemoveResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const cinfo = this.readChangeInfo();
            return new msg.Nfsv4RemoveResponse(status, new msg.Nfsv4RemoveResOk(cinfo));
        }
        return new msg.Nfsv4RemoveResponse(status);
    }
    decodeRenameRequest() {
        const xdr = this.xdr;
        const oldname = xdr.readString();
        const newname = xdr.readString();
        return new msg.Nfsv4RenameRequest(oldname, newname);
    }
    decodeRenameResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const sourceCinfo = this.readChangeInfo();
            const targetCinfo = this.readChangeInfo();
            return new msg.Nfsv4RenameResponse(status, new msg.Nfsv4RenameResOk(sourceCinfo, targetCinfo));
        }
        return new msg.Nfsv4RenameResponse(status);
    }
    decodeRenewRequest() {
        const clientid = this.xdr.readUnsignedHyper();
        return new msg.Nfsv4RenewRequest(clientid);
    }
    decodeRenewResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4RenewResponse(status);
    }
    decodeRestorefhRequest() {
        return new msg.Nfsv4RestorefhRequest();
    }
    decodeRestorefhResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4RestorefhResponse(status);
    }
    decodeSavefhRequest() {
        return new msg.Nfsv4SavefhRequest();
    }
    decodeSavefhResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4SavefhResponse(status);
    }
    decodeSecinfoRequest() {
        const name = this.xdr.readString();
        return new msg.Nfsv4SecinfoRequest(name);
    }
    decodeSecinfoResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const count = xdr.readUnsignedInt();
            const flavors = [];
            for (let i = 0; i < count; i++)
                flavors.push(this.readSecInfoFlavor());
            return new msg.Nfsv4SecinfoResponse(status, new msg.Nfsv4SecinfoResOk(flavors));
        }
        return new msg.Nfsv4SecinfoResponse(status);
    }
    decodeSetattrRequest() {
        const stateid = this.readStateid();
        const objAttributes = this.readFattr();
        return new msg.Nfsv4SetattrRequest(stateid, objAttributes);
    }
    decodeSetattrResponse() {
        const status = this.xdr.readUnsignedInt();
        const attrset = this.readBitmap();
        return new msg.Nfsv4SetattrResponse(status, new msg.Nfsv4SetattrResOk(attrset));
    }
    decodeSetclientidRequest() {
        const client = this.readClientId();
        const callback = this.readCbClient();
        const callbackIdent = this.xdr.readUnsignedInt();
        return new msg.Nfsv4SetclientidRequest(client, callback, callbackIdent);
    }
    decodeSetclientidResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const clientid = xdr.readUnsignedHyper();
            const setclientidConfirm = this.readVerifier();
            return new msg.Nfsv4SetclientidResponse(status, new msg.Nfsv4SetclientidResOk(clientid, setclientidConfirm));
        }
        return new msg.Nfsv4SetclientidResponse(status);
    }
    decodeSetclientidConfirmRequest() {
        const clientid = this.xdr.readUnsignedHyper();
        const setclientidConfirm = this.readVerifier();
        return new msg.Nfsv4SetclientidConfirmRequest(clientid, setclientidConfirm);
    }
    decodeSetclientidConfirmResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4SetclientidConfirmResponse(status);
    }
    decodeVerifyRequest() {
        const objAttributes = this.readFattr();
        return new msg.Nfsv4VerifyRequest(objAttributes);
    }
    decodeVerifyResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4VerifyResponse(status);
    }
    decodeWriteRequest() {
        const xdr = this.xdr;
        const stateid = this.readStateid();
        const offset = xdr.readUnsignedHyper();
        const stable = xdr.readUnsignedInt();
        const data = xdr.readVarlenOpaque();
        return new msg.Nfsv4WriteRequest(stateid, offset, stable, data);
    }
    decodeWriteResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status === 0) {
            const count = xdr.readUnsignedInt();
            const committed = xdr.readUnsignedInt();
            const writeverf = this.readVerifier();
            return new msg.Nfsv4WriteResponse(status, new msg.Nfsv4WriteResOk(count, committed, writeverf));
        }
        return new msg.Nfsv4WriteResponse(status);
    }
    decodeReleaseLockOwnerRequest() {
        const lockOwner = this.readLockOwner();
        return new msg.Nfsv4ReleaseLockOwnerRequest(lockOwner);
    }
    decodeReleaseLockOwnerResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4ReleaseLockOwnerResponse(status);
    }
    decodeIllegalRequest() {
        return new msg.Nfsv4IllegalRequest();
    }
    decodeIllegalResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4IllegalResponse(status);
    }
    decodeCbCompound(reader, isRequest) {
        this.xdr.reader = reader;
        const startPos = reader.x;
        try {
            if (isRequest) {
                return this.decodeCbCompoundRequest();
            }
            else {
                return this.decodeCbCompoundResponse();
            }
        }
        catch (err) {
            if (err instanceof RangeError) {
                reader.x = startPos;
                return undefined;
            }
            throw err;
        }
    }
    decodeCbCompoundRequest() {
        const xdr = this.xdr;
        const tag = xdr.readString();
        const minorversion = xdr.readUnsignedInt();
        const callbackIdent = xdr.readUnsignedInt();
        const argarray = [];
        const count = xdr.readUnsignedInt();
        for (let i = 0; i < count; i++) {
            const op = xdr.readUnsignedInt();
            const request = this.decodeCbRequest(op);
            if (request)
                argarray.push(request);
        }
        return new msg.Nfsv4CbCompoundRequest(tag, minorversion, callbackIdent, argarray);
    }
    decodeCbCompoundResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        const tag = xdr.readString();
        const resarray = [];
        const count = xdr.readUnsignedInt();
        for (let i = 0; i < count; i++) {
            const op = xdr.readUnsignedInt();
            const response = this.decodeCbResponse(op);
            if (response)
                resarray.push(response);
        }
        return new msg.Nfsv4CbCompoundResponse(status, tag, resarray);
    }
    decodeCbRequest(op) {
        switch (op) {
            case 3:
                return this.decodeCbGetattrRequest();
            case 4:
                return this.decodeCbRecallRequest();
            case 10044:
                return this.decodeCbIllegalRequest();
            default:
                throw new errors_1.Nfsv4DecodingError(`Unknown callback operation: ${op}`);
        }
    }
    decodeCbResponse(op) {
        switch (op) {
            case 3:
                return this.decodeCbGetattrResponse();
            case 4:
                return this.decodeCbRecallResponse();
            case 10044:
                return this.decodeCbIllegalResponse();
            default:
                throw new errors_1.Nfsv4DecodingError(`Unknown callback operation: ${op}`);
        }
    }
    decodeCbGetattrRequest() {
        const fh = this.readFh();
        const attrRequest = this.readBitmap();
        return new msg.Nfsv4CbGetattrRequest(fh, attrRequest);
    }
    decodeCbGetattrResponse() {
        const status = this.xdr.readUnsignedInt();
        if (status === 0) {
            const objAttributes = this.readFattr();
            return new msg.Nfsv4CbGetattrResponse(status, new msg.Nfsv4CbGetattrResOk(objAttributes));
        }
        return new msg.Nfsv4CbGetattrResponse(status);
    }
    decodeCbRecallRequest() {
        const stateid = this.readStateid();
        const truncate = this.xdr.readBoolean();
        const fh = this.readFh();
        return new msg.Nfsv4CbRecallRequest(stateid, truncate, fh);
    }
    decodeCbRecallResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4CbRecallResponse(status);
    }
    decodeCbIllegalRequest() {
        return new msg.Nfsv4CbIllegalRequest();
    }
    decodeCbIllegalResponse() {
        const status = this.xdr.readUnsignedInt();
        return new msg.Nfsv4CbIllegalResponse(status);
    }
}
exports.Nfsv4Decoder = Nfsv4Decoder;
//# sourceMappingURL=Nfsv4Decoder.js.map