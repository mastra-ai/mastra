"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4SecInfoFlavor = exports.Nfsv4RpcSecGssInfo = exports.Nfsv4CreateType = exports.Nfsv4CreateTypeVoid = exports.Nfsv4CreateTypeDevice = exports.Nfsv4CreateTypeLink = exports.Nfsv4LockOwnerInfo = exports.Nfsv4LockExistingOwner = exports.Nfsv4LockNewOwner = exports.Nfsv4Entry = exports.Nfsv4OpenDelegation = exports.Nfsv4OpenWriteDelegation = exports.Nfsv4OpenReadDelegation = exports.Nfsv4OpenClaim = exports.Nfsv4OpenClaimDelegatePrev = exports.Nfsv4OpenClaimDelegateCur = exports.Nfsv4OpenClaimPrevious = exports.Nfsv4OpenClaimNull = exports.Nfsv4OpenHow = exports.Nfsv4CreateHow = exports.Nfsv4CreateVerf = exports.Nfsv4CreateAttrs = exports.Nfsv4SecInfo = exports.Nfsv4Acl = exports.Nfsv4Ace = exports.Nfsv4FsLocations = exports.Nfsv4FsLocation = exports.Nfsv4OpenToLockOwner = exports.Nfsv4LockOwner = exports.Nfsv4OpenOwner = exports.Nfsv4ClientId = exports.Nfsv4CbClient = exports.Nfsv4ClientAddr = exports.Nfsv4Fattr = exports.Nfsv4Bitmap = exports.Nfsv4SetTime = exports.Nfsv4ChangeInfo = exports.Nfsv4Stateid = exports.Nfsv4Fsid = exports.Nfsv4Verifier = exports.Nfsv4Fh = exports.Nfsv4SpecData = exports.Nfsv4Time = void 0;
class Nfsv4Time {
    constructor(seconds, nseconds) {
        this.seconds = seconds;
        this.nseconds = nseconds;
    }
    encode(xdr) {
        xdr.writeHyper(this.seconds);
        xdr.writeUnsignedInt(this.nseconds);
    }
}
exports.Nfsv4Time = Nfsv4Time;
class Nfsv4SpecData {
    constructor(specdata1, specdata2) {
        this.specdata1 = specdata1;
        this.specdata2 = specdata2;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.specdata1);
        xdr.writeUnsignedInt(this.specdata2);
    }
}
exports.Nfsv4SpecData = Nfsv4SpecData;
class Nfsv4Fh {
    constructor(data) {
        this.data = data;
    }
    encode(xdr) {
        xdr.writeVarlenOpaque(this.data);
    }
}
exports.Nfsv4Fh = Nfsv4Fh;
class Nfsv4Verifier {
    constructor(data) {
        this.data = data;
    }
    encode(xdr) {
        xdr.writeOpaque(this.data);
    }
}
exports.Nfsv4Verifier = Nfsv4Verifier;
class Nfsv4Fsid {
    constructor(major, minor) {
        this.major = major;
        this.minor = minor;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.major);
        xdr.writeUnsignedHyper(this.minor);
    }
}
exports.Nfsv4Fsid = Nfsv4Fsid;
class Nfsv4Stateid {
    static decode(xdr) {
        const seqid = xdr.readUnsignedInt();
        const other = xdr.readOpaque(12);
        return new Nfsv4Stateid(seqid, other);
    }
    constructor(seqid, other) {
        this.seqid = seqid;
        this.other = other;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.seqid);
        xdr.writeOpaque(this.other);
    }
}
exports.Nfsv4Stateid = Nfsv4Stateid;
class Nfsv4ChangeInfo {
    constructor(atomic, before, after) {
        this.atomic = atomic;
        this.before = before;
        this.after = after;
    }
    encode(xdr) {
        xdr.writeBoolean(this.atomic);
        xdr.writeUnsignedHyper(this.before);
        xdr.writeUnsignedHyper(this.after);
    }
}
exports.Nfsv4ChangeInfo = Nfsv4ChangeInfo;
class Nfsv4SetTime {
    constructor(how, time) {
        this.how = how;
        this.time = time;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.how);
        if (this.time) {
            this.time.encode(xdr);
        }
    }
}
exports.Nfsv4SetTime = Nfsv4SetTime;
class Nfsv4Bitmap {
    constructor(mask) {
        this.mask = mask;
    }
    encode(xdr) {
        const mask = this.mask;
        const length = mask.length;
        xdr.writeUnsignedInt(length);
        for (let i = 0; i < length; i++)
            xdr.writeUnsignedInt(mask[i]);
    }
}
exports.Nfsv4Bitmap = Nfsv4Bitmap;
class Nfsv4Fattr {
    constructor(attrmask, attrVals) {
        this.attrmask = attrmask;
        this.attrVals = attrVals;
    }
    encode(xdr) {
        this.attrmask.encode(xdr);
        xdr.writeVarlenOpaque(this.attrVals);
    }
}
exports.Nfsv4Fattr = Nfsv4Fattr;
class Nfsv4ClientAddr {
    constructor(rNetid, rAddr) {
        this.rNetid = rNetid;
        this.rAddr = rAddr;
    }
    encode(xdr) {
        xdr.writeStr(this.rNetid);
        xdr.writeStr(this.rAddr);
    }
}
exports.Nfsv4ClientAddr = Nfsv4ClientAddr;
class Nfsv4CbClient {
    constructor(cbProgram, cbLocation) {
        this.cbProgram = cbProgram;
        this.cbLocation = cbLocation;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.cbProgram);
        this.cbLocation.encode(xdr);
    }
}
exports.Nfsv4CbClient = Nfsv4CbClient;
class Nfsv4ClientId {
    constructor(verifier, id) {
        this.verifier = verifier;
        this.id = id;
    }
    encode(xdr) {
        this.verifier.encode(xdr);
        xdr.writeVarlenOpaque(this.id);
    }
}
exports.Nfsv4ClientId = Nfsv4ClientId;
class Nfsv4OpenOwner {
    constructor(clientid, owner) {
        this.clientid = clientid;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.clientid);
        xdr.writeVarlenOpaque(this.owner);
    }
}
exports.Nfsv4OpenOwner = Nfsv4OpenOwner;
class Nfsv4LockOwner {
    constructor(clientid, owner) {
        this.clientid = clientid;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.clientid);
        xdr.writeVarlenOpaque(this.owner);
    }
}
exports.Nfsv4LockOwner = Nfsv4LockOwner;
class Nfsv4OpenToLockOwner {
    constructor(openSeqid, openStateid, lockSeqid, lockOwner) {
        this.openSeqid = openSeqid;
        this.openStateid = openStateid;
        this.lockSeqid = lockSeqid;
        this.lockOwner = lockOwner;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.openSeqid);
        this.openStateid.encode(xdr);
        xdr.writeUnsignedInt(this.lockSeqid);
        this.lockOwner.encode(xdr);
    }
}
exports.Nfsv4OpenToLockOwner = Nfsv4OpenToLockOwner;
class Nfsv4FsLocation {
    constructor(server, rootpath) {
        this.server = server;
        this.rootpath = rootpath;
    }
    encode(xdr) {
        const { server, rootpath } = this;
        const serverLen = server.length;
        xdr.writeUnsignedInt(serverLen);
        for (let i = 0; i < serverLen; i++)
            xdr.writeStr(server[i]);
        const rootpathLen = rootpath.length;
        xdr.writeUnsignedInt(rootpathLen);
        for (let i = 0; i < rootpathLen; i++)
            xdr.writeStr(rootpath[i]);
    }
}
exports.Nfsv4FsLocation = Nfsv4FsLocation;
class Nfsv4FsLocations {
    constructor(fsRoot, locations) {
        this.fsRoot = fsRoot;
        this.locations = locations;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.fsRoot.length);
        const { fsRoot, locations } = this;
        const fsRootLen = fsRoot.length;
        for (let i = 0; i < fsRootLen; i++)
            xdr.writeStr(fsRoot[i]);
        const locationsLen = locations.length;
        xdr.writeUnsignedInt(locationsLen);
        for (let i = 0; i < locationsLen; i++)
            locations[i].encode(xdr);
    }
}
exports.Nfsv4FsLocations = Nfsv4FsLocations;
class Nfsv4Ace {
    constructor(type, flag, accessMask, who) {
        this.type = type;
        this.flag = flag;
        this.accessMask = accessMask;
        this.who = who;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.type);
        xdr.writeUnsignedInt(this.flag);
        xdr.writeUnsignedInt(this.accessMask);
        xdr.writeStr(this.who);
    }
}
exports.Nfsv4Ace = Nfsv4Ace;
class Nfsv4Acl {
    constructor(aces) {
        this.aces = aces;
    }
    encode(xdr) {
        const aces = this.aces;
        const length = aces.length;
        xdr.writeUnsignedInt(length);
        for (let i = 0; i < length; i++)
            aces[i].encode(xdr);
    }
}
exports.Nfsv4Acl = Nfsv4Acl;
class Nfsv4SecInfo {
    constructor(flavor, flavorInfo) {
        this.flavor = flavor;
        this.flavorInfo = flavorInfo;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.flavor);
        const flavorInfo = this.flavorInfo;
        if (flavorInfo)
            xdr.writeVarlenOpaque(flavorInfo);
    }
}
exports.Nfsv4SecInfo = Nfsv4SecInfo;
class Nfsv4CreateAttrs {
    constructor(createattrs) {
        this.createattrs = createattrs;
    }
    encode(xdr) {
        this.createattrs.encode(xdr);
    }
}
exports.Nfsv4CreateAttrs = Nfsv4CreateAttrs;
class Nfsv4CreateVerf {
    constructor(createverf) {
        this.createverf = createverf;
    }
    encode(xdr) {
        this.createverf.encode(xdr);
    }
}
exports.Nfsv4CreateVerf = Nfsv4CreateVerf;
class Nfsv4CreateHow {
    constructor(mode, how) {
        this.mode = mode;
        this.how = how;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.mode);
        this.how?.encode(xdr);
    }
}
exports.Nfsv4CreateHow = Nfsv4CreateHow;
class Nfsv4OpenHow {
    constructor(opentype, how) {
        this.opentype = opentype;
        this.how = how;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.opentype);
        this.how?.encode(xdr);
    }
}
exports.Nfsv4OpenHow = Nfsv4OpenHow;
class Nfsv4OpenClaimNull {
    constructor(file) {
        this.file = file;
    }
    encode(xdr) {
        xdr.writeStr(this.file);
    }
}
exports.Nfsv4OpenClaimNull = Nfsv4OpenClaimNull;
class Nfsv4OpenClaimPrevious {
    constructor(delegateType) {
        this.delegateType = delegateType;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.delegateType);
    }
}
exports.Nfsv4OpenClaimPrevious = Nfsv4OpenClaimPrevious;
class Nfsv4OpenClaimDelegateCur {
    constructor(delegateStateid, file) {
        this.delegateStateid = delegateStateid;
        this.file = file;
    }
    encode(xdr) {
        this.delegateStateid.encode(xdr);
        xdr.writeStr(this.file);
    }
}
exports.Nfsv4OpenClaimDelegateCur = Nfsv4OpenClaimDelegateCur;
class Nfsv4OpenClaimDelegatePrev {
    constructor(file) {
        this.file = file;
    }
    encode(xdr) {
        xdr.writeStr(this.file);
    }
}
exports.Nfsv4OpenClaimDelegatePrev = Nfsv4OpenClaimDelegatePrev;
class Nfsv4OpenClaim {
    constructor(claimType, claim) {
        this.claimType = claimType;
        this.claim = claim;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.claimType);
        this.claim.encode(xdr);
    }
}
exports.Nfsv4OpenClaim = Nfsv4OpenClaim;
class Nfsv4OpenReadDelegation {
    constructor(stateid, recall, permissions) {
        this.stateid = stateid;
        this.recall = recall;
        this.permissions = permissions;
    }
    encode(xdr) {
        this.stateid.encode(xdr);
        xdr.writeBoolean(this.recall);
        const permissions = this.permissions;
        const length = permissions.length;
        xdr.writeUnsignedInt(length);
        for (let i = 0; i < length; i++)
            permissions[i].encode(xdr);
    }
}
exports.Nfsv4OpenReadDelegation = Nfsv4OpenReadDelegation;
class Nfsv4OpenWriteDelegation {
    constructor(stateid, recall, spaceLimit, permissions) {
        this.stateid = stateid;
        this.recall = recall;
        this.spaceLimit = spaceLimit;
        this.permissions = permissions;
    }
    encode(xdr) {
        this.stateid.encode(xdr);
        xdr.writeBoolean(this.recall);
        xdr.writeUnsignedHyper(this.spaceLimit);
        const permissions = this.permissions;
        const length = permissions.length;
        xdr.writeUnsignedInt(length);
        for (let i = 0; i < length; i++)
            permissions[i].encode(xdr);
    }
}
exports.Nfsv4OpenWriteDelegation = Nfsv4OpenWriteDelegation;
class Nfsv4OpenDelegation {
    constructor(delegationType, delegation) {
        this.delegationType = delegationType;
        this.delegation = delegation;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.delegationType);
        this.delegation?.encode(xdr);
    }
}
exports.Nfsv4OpenDelegation = Nfsv4OpenDelegation;
class Nfsv4Entry {
    constructor(cookie, name, attrs, nextEntry) {
        this.cookie = cookie;
        this.name = name;
        this.attrs = attrs;
        this.nextEntry = nextEntry;
    }
    encode(xdr) {
        xdr.writeUnsignedHyper(this.cookie);
        xdr.writeStr(this.name);
        this.attrs.encode(xdr);
    }
}
exports.Nfsv4Entry = Nfsv4Entry;
class Nfsv4LockNewOwner {
    constructor(openToLockOwner) {
        this.openToLockOwner = openToLockOwner;
    }
    encode(xdr) {
        this.openToLockOwner.encode(xdr);
    }
}
exports.Nfsv4LockNewOwner = Nfsv4LockNewOwner;
class Nfsv4LockExistingOwner {
    constructor(lockStateid, lockSeqid) {
        this.lockStateid = lockStateid;
        this.lockSeqid = lockSeqid;
    }
    encode(xdr) {
        this.lockStateid.encode(xdr);
        xdr.writeUnsignedInt(this.lockSeqid);
    }
}
exports.Nfsv4LockExistingOwner = Nfsv4LockExistingOwner;
class Nfsv4LockOwnerInfo {
    constructor(newLockOwner, owner) {
        this.newLockOwner = newLockOwner;
        this.owner = owner;
    }
    encode(xdr) {
        xdr.writeBoolean(this.newLockOwner);
        this.owner.encode(xdr);
    }
}
exports.Nfsv4LockOwnerInfo = Nfsv4LockOwnerInfo;
class Nfsv4CreateTypeLink {
    constructor(linkdata) {
        this.linkdata = linkdata;
    }
    encode(xdr) {
        xdr.writeStr(this.linkdata);
    }
}
exports.Nfsv4CreateTypeLink = Nfsv4CreateTypeLink;
class Nfsv4CreateTypeDevice {
    constructor(devdata) {
        this.devdata = devdata;
    }
    encode(xdr) {
        this.devdata.encode(xdr);
    }
}
exports.Nfsv4CreateTypeDevice = Nfsv4CreateTypeDevice;
class Nfsv4CreateTypeVoid {
    encode(xdr) { }
}
exports.Nfsv4CreateTypeVoid = Nfsv4CreateTypeVoid;
class Nfsv4CreateType {
    constructor(type, objtype) {
        this.type = type;
        this.objtype = objtype;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.type);
        this.objtype.encode(xdr);
    }
}
exports.Nfsv4CreateType = Nfsv4CreateType;
class Nfsv4RpcSecGssInfo {
    constructor(oid, qop, service) {
        this.oid = oid;
        this.qop = qop;
        this.service = service;
    }
    encode(xdr) {
        xdr.writeVarlenOpaque(this.oid);
        xdr.writeUnsignedInt(this.qop);
        xdr.writeUnsignedInt(this.service);
    }
}
exports.Nfsv4RpcSecGssInfo = Nfsv4RpcSecGssInfo;
class Nfsv4SecInfoFlavor {
    constructor(flavor, flavorInfo) {
        this.flavor = flavor;
        this.flavorInfo = flavorInfo;
    }
    encode(xdr) {
        xdr.writeUnsignedInt(this.flavor);
        this.flavorInfo?.encode(xdr);
    }
}
exports.Nfsv4SecInfoFlavor = Nfsv4SecInfoFlavor;
//# sourceMappingURL=structs.js.map