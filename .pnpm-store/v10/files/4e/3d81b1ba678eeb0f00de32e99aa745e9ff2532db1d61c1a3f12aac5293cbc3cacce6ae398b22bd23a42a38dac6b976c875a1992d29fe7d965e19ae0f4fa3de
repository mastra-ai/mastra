"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNfsv4CompoundResponse = exports.formatNfsv4CompoundRequest = exports.formatNfsv4Response = exports.formatNfsv4Request = exports.formatNfsv4Bitmap = exports.formatNfsv4Mode = exports.formatNfsv4Access = exports.formatNfsv4LockType = exports.formatNfsv4DelegType = exports.formatNfsv4OpenClaimType = exports.formatNfsv4OpenDeny = exports.formatNfsv4OpenAccess = exports.formatNfsv4OpenFlags = exports.formatNfsv4CreateMode = exports.formatNfsv4StableHow = exports.formatNfsv4TimeHow = exports.formatNfsv4FType = exports.formatNfsv4Attr = exports.formatNfsv4Op = exports.formatNfsv4Stat = void 0;
const tslib_1 = require("tslib");
const msg = tslib_1.__importStar(require("./messages"));
const attributes_1 = require("./attributes");
const printTree_1 = require("tree-dump/lib/printTree");
const formatNfsv4Stat = (stat) => {
    switch (stat) {
        case 0:
            return 'NFS4_OK';
        case 1:
            return 'NFS4ERR_PERM';
        case 2:
            return 'NFS4ERR_NOENT';
        case 5:
            return 'NFS4ERR_IO';
        case 6:
            return 'NFS4ERR_NXIO';
        case 13:
            return 'NFS4ERR_ACCESS';
        case 17:
            return 'NFS4ERR_EXIST';
        case 18:
            return 'NFS4ERR_XDEV';
        case 20:
            return 'NFS4ERR_NOTDIR';
        case 21:
            return 'NFS4ERR_ISDIR';
        case 22:
            return 'NFS4ERR_INVAL';
        case 27:
            return 'NFS4ERR_FBIG';
        case 28:
            return 'NFS4ERR_NOSPC';
        case 30:
            return 'NFS4ERR_ROFS';
        case 31:
            return 'NFS4ERR_MLINK';
        case 63:
            return 'NFS4ERR_NAMETOOLONG';
        case 66:
            return 'NFS4ERR_NOTEMPTY';
        case 69:
            return 'NFS4ERR_DQUOT';
        case 70:
            return 'NFS4ERR_STALE';
        case 10001:
            return 'NFS4ERR_BADHANDLE';
        case 10003:
            return 'NFS4ERR_BAD_COOKIE';
        case 10004:
            return 'NFS4ERR_NOTSUPP';
        case 10005:
            return 'NFS4ERR_TOOSMALL';
        case 10006:
            return 'NFS4ERR_SERVERFAULT';
        case 10007:
            return 'NFS4ERR_BADTYPE';
        case 10008:
            return 'NFS4ERR_DELAY';
        case 10009:
            return 'NFS4ERR_SAME';
        case 10010:
            return 'NFS4ERR_DENIED';
        case 10011:
            return 'NFS4ERR_EXPIRED';
        case 10012:
            return 'NFS4ERR_LOCKED';
        case 10013:
            return 'NFS4ERR_GRACE';
        case 10014:
            return 'NFS4ERR_FHEXPIRED';
        case 10015:
            return 'NFS4ERR_SHARE_DENIED';
        case 10016:
            return 'NFS4ERR_WRONGSEC';
        case 10017:
            return 'NFS4ERR_CLID_INUSE';
        case 10018:
            return 'NFS4ERR_RESOURCE';
        case 10019:
            return 'NFS4ERR_MOVED';
        case 10020:
            return 'NFS4ERR_NOFILEHANDLE';
        case 10021:
            return 'NFS4ERR_MINOR_VERS_MISMATCH';
        case 10022:
            return 'NFS4ERR_STALE_CLIENTID';
        case 10023:
            return 'NFS4ERR_STALE_STATEID';
        case 10024:
            return 'NFS4ERR_OLD_STATEID';
        case 10025:
            return 'NFS4ERR_BAD_STATEID';
        case 10026:
            return 'NFS4ERR_BAD_SEQID';
        case 10027:
            return 'NFS4ERR_NOT_SAME';
        case 10028:
            return 'NFS4ERR_LOCK_RANGE';
        case 10029:
            return 'NFS4ERR_SYMLINK';
        case 10030:
            return 'NFS4ERR_RESTOREFH';
        case 10031:
            return 'NFS4ERR_LEASE_MOVED';
        case 10032:
            return 'NFS4ERR_ATTRNOTSUPP';
        case 10033:
            return 'NFS4ERR_NO_GRACE';
        case 10034:
            return 'NFS4ERR_RECLAIM_BAD';
        case 10035:
            return 'NFS4ERR_RECLAIM_CONFLICT';
        case 10036:
            return 'NFS4ERR_BADXDR';
        case 10037:
            return 'NFS4ERR_LOCKS_HELD';
        case 10038:
            return 'NFS4ERR_OPENMODE';
        case 10039:
            return 'NFS4ERR_BADOWNER';
        case 10040:
            return 'NFS4ERR_BADCHAR';
        case 10041:
            return 'NFS4ERR_BADNAME';
        case 10042:
            return 'NFS4ERR_BAD_RANGE';
        case 10043:
            return 'NFS4ERR_LOCK_NOTSUPP';
        case 10044:
            return 'NFS4ERR_OP_ILLEGAL';
        case 10045:
            return 'NFS4ERR_DEADLOCK';
        case 10046:
            return 'NFS4ERR_FILE_OPEN';
        case 10047:
            return 'NFS4ERR_ADMIN_REVOKED';
        case 10048:
            return 'NFS4ERR_CB_PATH_DOWN';
        default:
            return `Unknown(${stat})`;
    }
};
exports.formatNfsv4Stat = formatNfsv4Stat;
const formatNfsv4Op = (op) => {
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
        default:
            return `Unknown(${op})`;
    }
};
exports.formatNfsv4Op = formatNfsv4Op;
const formatNfsv4Attr = (attr) => {
    switch (attr) {
        case 0:
            return 'supported_attrs';
        case 1:
            return 'type';
        case 2:
            return 'fh_expire_type';
        case 3:
            return 'change';
        case 4:
            return 'size';
        case 5:
            return 'link_support';
        case 6:
            return 'symlink_support';
        case 7:
            return 'named_attr';
        case 8:
            return 'fsid';
        case 9:
            return 'unique_handles';
        case 10:
            return 'lease_time';
        case 11:
            return 'rdattr_error';
        case 12:
            return 'acl';
        case 13:
            return 'aclsupport';
        case 14:
            return 'archive';
        case 15:
            return 'can_set_time';
        case 16:
            return 'case_insensitive';
        case 17:
            return 'case_preserving';
        case 18:
            return 'chown_restricted';
        case 19:
            return 'filehandle';
        case 20:
            return 'fileid';
        case 21:
            return 'files_avail';
        case 22:
            return 'files_free';
        case 23:
            return 'files_total';
        case 24:
            return 'fs_locations';
        case 25:
            return 'hidden';
        case 26:
            return 'homogeneous';
        case 27:
            return 'maxfilesize';
        case 28:
            return 'maxlink';
        case 29:
            return 'maxname';
        case 30:
            return 'maxread';
        case 31:
            return 'maxwrite';
        case 32:
            return 'mimetype';
        case 33:
            return 'mode';
        case 34:
            return 'no_trunc';
        case 35:
            return 'numlinks';
        case 36:
            return 'owner';
        case 37:
            return 'owner_group';
        case 38:
            return 'quota_avail_hard';
        case 39:
            return 'quota_avail_soft';
        case 40:
            return 'quota_used';
        case 41:
            return 'rawdev';
        case 42:
            return 'space_avail';
        case 43:
            return 'space_free';
        case 44:
            return 'space_total';
        case 45:
            return 'space_used';
        case 46:
            return 'system';
        case 47:
            return 'time_access';
        case 48:
            return 'time_access_set';
        case 49:
            return 'time_backup';
        case 50:
            return 'time_create';
        case 51:
            return 'time_delta';
        case 52:
            return 'time_metadata';
        case 53:
            return 'time_modify';
        case 54:
            return 'time_modify_set';
        case 55:
            return 'mounted_on_fileid';
        default:
            return `Unknown(${attr})`;
    }
};
exports.formatNfsv4Attr = formatNfsv4Attr;
const formatNfsv4FType = (ftype) => {
    switch (ftype) {
        case 1:
            return 'NF4REG';
        case 2:
            return 'NF4DIR';
        case 3:
            return 'NF4BLK';
        case 4:
            return 'NF4CHR';
        case 5:
            return 'NF4LNK';
        case 6:
            return 'NF4SOCK';
        case 7:
            return 'NF4FIFO';
        case 8:
            return 'NF4ATTRDIR';
        case 9:
            return 'NF4NAMEDATTR';
        default:
            return `Unknown(${ftype})`;
    }
};
exports.formatNfsv4FType = formatNfsv4FType;
const formatNfsv4TimeHow = (how) => {
    switch (how) {
        case 0:
            return 'SET_TO_SERVER_TIME4';
        case 1:
            return 'SET_TO_CLIENT_TIME4';
        default:
            return `Unknown(${how})`;
    }
};
exports.formatNfsv4TimeHow = formatNfsv4TimeHow;
const formatNfsv4StableHow = (stable) => {
    switch (stable) {
        case 0:
            return 'UNSTABLE4';
        case 1:
            return 'DATA_SYNC4';
        case 2:
            return 'FILE_SYNC4';
        default:
            return `Unknown(${stable})`;
    }
};
exports.formatNfsv4StableHow = formatNfsv4StableHow;
const formatNfsv4CreateMode = (mode) => {
    switch (mode) {
        case 0:
            return 'UNCHECKED4';
        case 1:
            return 'GUARDED4';
        case 2:
            return 'EXCLUSIVE4';
        default:
            return `Unknown(${mode})`;
    }
};
exports.formatNfsv4CreateMode = formatNfsv4CreateMode;
const formatNfsv4OpenFlags = (flags) => {
    switch (flags) {
        case 0:
            return 'OPEN4_NOCREATE';
        case 1:
            return 'OPEN4_CREATE';
        default:
            return `Unknown(${flags})`;
    }
};
exports.formatNfsv4OpenFlags = formatNfsv4OpenFlags;
const formatNfsv4OpenAccess = (access) => {
    switch (access) {
        case 1:
            return 'OPEN4_SHARE_ACCESS_READ';
        case 2:
            return 'OPEN4_SHARE_ACCESS_WRITE';
        case 3:
            return 'OPEN4_SHARE_ACCESS_BOTH';
        default:
            return `Unknown(${access})`;
    }
};
exports.formatNfsv4OpenAccess = formatNfsv4OpenAccess;
const formatNfsv4OpenDeny = (deny) => {
    switch (deny) {
        case 0:
            return 'OPEN4_SHARE_DENY_NONE';
        case 1:
            return 'OPEN4_SHARE_DENY_READ';
        case 2:
            return 'OPEN4_SHARE_DENY_WRITE';
        case 3:
            return 'OPEN4_SHARE_DENY_BOTH';
        default:
            return `Unknown(${deny})`;
    }
};
exports.formatNfsv4OpenDeny = formatNfsv4OpenDeny;
const formatNfsv4OpenClaimType = (claim) => {
    switch (claim) {
        case 0:
            return 'CLAIM_NULL';
        case 1:
            return 'CLAIM_PREVIOUS';
        case 2:
            return 'CLAIM_DELEGATE_CUR';
        case 3:
            return 'CLAIM_DELEGATE_PREV';
        default:
            return `Unknown(${claim})`;
    }
};
exports.formatNfsv4OpenClaimType = formatNfsv4OpenClaimType;
const formatNfsv4DelegType = (deleg) => {
    switch (deleg) {
        case 0:
            return 'OPEN_DELEGATE_NONE';
        case 1:
            return 'OPEN_DELEGATE_READ';
        case 2:
            return 'OPEN_DELEGATE_WRITE';
        default:
            return `Unknown(${deleg})`;
    }
};
exports.formatNfsv4DelegType = formatNfsv4DelegType;
const formatNfsv4LockType = (locktype) => {
    switch (locktype) {
        case 1:
            return 'READ_LT';
        case 2:
            return 'WRITE_LT';
        case 3:
            return 'READW_LT';
        case 4:
            return 'WRITEW_LT';
        default:
            return `Unknown(${locktype})`;
    }
};
exports.formatNfsv4LockType = formatNfsv4LockType;
const formatNfsv4Access = (access) => {
    const flags = [];
    if (access & 1)
        flags.push('READ');
    if (access & 2)
        flags.push('LOOKUP');
    if (access & 4)
        flags.push('MODIFY');
    if (access & 8)
        flags.push('EXTEND');
    if (access & 16)
        flags.push('DELETE');
    if (access & 32)
        flags.push('EXECUTE');
    return flags.length > 0 ? flags.join('|') : `0x${access.toString(16)}`;
};
exports.formatNfsv4Access = formatNfsv4Access;
const formatNfsv4Mode = (mode) => {
    const flags = [];
    if (mode & 2048)
        flags.push('SUID');
    if (mode & 1024)
        flags.push('SGID');
    if (mode & 512)
        flags.push('SVTX');
    if (mode & 256)
        flags.push('RUSR');
    if (mode & 128)
        flags.push('WUSR');
    if (mode & 64)
        flags.push('XUSR');
    if (mode & 32)
        flags.push('RGRP');
    if (mode & 16)
        flags.push('WGRP');
    if (mode & 8)
        flags.push('XGRP');
    if (mode & 4)
        flags.push('ROTH');
    if (mode & 2)
        flags.push('WOTH');
    if (mode & 1)
        flags.push('XOTH');
    const octal = mode.toString(8).padStart(4, '0');
    return flags.length > 0 ? `${octal} (${flags.join('|')})` : octal;
};
exports.formatNfsv4Mode = formatNfsv4Mode;
const formatNfsv4Bitmap = (bitmap) => {
    const attrs = [];
    const attrNums = (0, attributes_1.parseBitmask)(bitmap.mask);
    for (const num of attrNums)
        attrs.push((0, exports.formatNfsv4Attr)(num));
    return attrs.length > 0 ? `[${attrs.join(', ')}]` : '[]';
};
exports.formatNfsv4Bitmap = formatNfsv4Bitmap;
const formatBytes = (data, maxLen = 32) => {
    if (data.length === 0)
        return '[]';
    const hex = Array.from(data.slice(0, maxLen), (b) => b.toString(16).padStart(2, '0')).join(' ');
    return data.length > maxLen ? `[${hex}... (${data.length} bytes)]` : `[${hex}]`;
};
const formatStateid = (stateid, tab = '') => {
    return `Stateid { seqid = ${stateid.seqid}, other = ${formatBytes(stateid.other)} }`;
};
const formatFileHandle = (fh) => {
    return formatBytes(fh.data, 16);
};
const formatNfsv4Request = (req, tab = '') => {
    if (req instanceof msg.Nfsv4AccessRequest) {
        return `ACCESS access = ${(0, exports.formatNfsv4Access)(req.access)}`;
    }
    else if (req instanceof msg.Nfsv4CloseRequest) {
        return `CLOSE seqid = ${req.seqid}, stateid = ${formatStateid(req.openStateid, tab)}`;
    }
    else if (req instanceof msg.Nfsv4CommitRequest) {
        return `COMMIT offset = ${req.offset}, count = ${req.count}`;
    }
    else if (req instanceof msg.Nfsv4CreateRequest) {
        return `CREATE objtype = ${(0, exports.formatNfsv4FType)(req.objtype.type)}, objname = "${req.objname}"`;
    }
    else if (req instanceof msg.Nfsv4DelegpurgeRequest) {
        return `DELEGPURGE clientid = ${req.clientid}`;
    }
    else if (req instanceof msg.Nfsv4DelegreturnRequest) {
        return `DELEGRETURN stateid = ${formatStateid(req.delegStateid, tab)}`;
    }
    else if (req instanceof msg.Nfsv4GetattrRequest) {
        return `GETATTR attrs = ${(0, exports.formatNfsv4Bitmap)(req.attrRequest)}`;
    }
    else if (req instanceof msg.Nfsv4GetfhRequest) {
        return 'GETFH';
    }
    else if (req instanceof msg.Nfsv4LinkRequest) {
        return `LINK newname = "${req.newname}"`;
    }
    else if (req instanceof msg.Nfsv4LockRequest) {
        return `LOCK locktype = ${(0, exports.formatNfsv4LockType)(req.locktype)}, reclaim = ${req.reclaim}, offset = ${req.offset}, length = ${req.length}`;
    }
    else if (req instanceof msg.Nfsv4LocktRequest) {
        return `LOCKT locktype = ${(0, exports.formatNfsv4LockType)(req.locktype)}, offset = ${req.offset}, length = ${req.length}`;
    }
    else if (req instanceof msg.Nfsv4LockuRequest) {
        return `LOCKU locktype = ${(0, exports.formatNfsv4LockType)(req.locktype)}, seqid = ${req.seqid}, stateid = ${formatStateid(req.lockStateid, tab)}, offset = ${req.offset}, length = ${req.length}`;
    }
    else if (req instanceof msg.Nfsv4LookupRequest) {
        return `LOOKUP objname = "${req.objname}"`;
    }
    else if (req instanceof msg.Nfsv4LookuppRequest) {
        return 'LOOKUPP';
    }
    else if (req instanceof msg.Nfsv4NverifyRequest) {
        return `NVERIFY attrs = ${(0, exports.formatNfsv4Bitmap)(req.objAttributes.attrmask)}`;
    }
    else if (req instanceof msg.Nfsv4OpenRequest) {
        const createInfo = req.openhow.how ? `, createmode = ${(0, exports.formatNfsv4CreateMode)(req.openhow.how.mode)}` : '';
        return `OPEN seqid = ${req.seqid}, shareAccess = ${(0, exports.formatNfsv4OpenAccess)(req.shareAccess)}, shareDeny = ${(0, exports.formatNfsv4OpenDeny)(req.shareDeny)}, opentype = ${(0, exports.formatNfsv4OpenFlags)(req.openhow.opentype)}${createInfo}, claim = ${(0, exports.formatNfsv4OpenClaimType)(req.claim.claimType)}`;
    }
    else if (req instanceof msg.Nfsv4OpenattrRequest) {
        return `OPENATTR createdir = ${req.createdir}`;
    }
    else if (req instanceof msg.Nfsv4OpenConfirmRequest) {
        return `OPEN_CONFIRM stateid = ${formatStateid(req.openStateid, tab)}, seqid = ${req.seqid}`;
    }
    else if (req instanceof msg.Nfsv4OpenDowngradeRequest) {
        return `OPEN_DOWNGRADE stateid = ${formatStateid(req.openStateid, tab)}, seqid = ${req.seqid}, shareAccess = ${(0, exports.formatNfsv4OpenAccess)(req.shareAccess)}, shareDeny = ${(0, exports.formatNfsv4OpenDeny)(req.shareDeny)}`;
    }
    else if (req instanceof msg.Nfsv4PutfhRequest) {
        return `PUTFH fh = ${formatFileHandle(req.object)}`;
    }
    else if (req instanceof msg.Nfsv4PutpubfhRequest) {
        return 'PUTPUBFH';
    }
    else if (req instanceof msg.Nfsv4PutrootfhRequest) {
        return 'PUTROOTFH';
    }
    else if (req instanceof msg.Nfsv4ReadRequest) {
        return `READ stateid = ${formatStateid(req.stateid, tab)}, offset = ${req.offset}, count = ${req.count}`;
    }
    else if (req instanceof msg.Nfsv4ReaddirRequest) {
        return `READDIR cookie = ${req.cookie}, dircount = ${req.dircount}, maxcount = ${req.maxcount}, attrs = ${(0, exports.formatNfsv4Bitmap)(req.attrRequest)}`;
    }
    else if (req instanceof msg.Nfsv4ReadlinkRequest) {
        return 'READLINK';
    }
    else if (req instanceof msg.Nfsv4RemoveRequest) {
        return `REMOVE target = "${req.target}"`;
    }
    else if (req instanceof msg.Nfsv4RenameRequest) {
        return `RENAME oldname = "${req.oldname}", newname = "${req.newname}"`;
    }
    else if (req instanceof msg.Nfsv4RenewRequest) {
        return `RENEW clientid = ${req.clientid}`;
    }
    else if (req instanceof msg.Nfsv4RestorefhRequest) {
        return 'RESTOREFH';
    }
    else if (req instanceof msg.Nfsv4SavefhRequest) {
        return 'SAVEFH';
    }
    else if (req instanceof msg.Nfsv4SecinfoRequest) {
        return `SECINFO name = "${req.name}"`;
    }
    else if (req instanceof msg.Nfsv4SetattrRequest) {
        return `SETATTR stateid = ${formatStateid(req.stateid, tab)}, attrs = ${(0, exports.formatNfsv4Bitmap)(req.objAttributes.attrmask)}`;
    }
    else if (req instanceof msg.Nfsv4SetclientidRequest) {
        return `SETCLIENTID callbackIdent = ${req.callbackIdent}`;
    }
    else if (req instanceof msg.Nfsv4SetclientidConfirmRequest) {
        return `SETCLIENTID_CONFIRM clientid = ${req.clientid}`;
    }
    else if (req instanceof msg.Nfsv4VerifyRequest) {
        return `VERIFY attrs = ${(0, exports.formatNfsv4Bitmap)(req.objAttributes.attrmask)}`;
    }
    else if (req instanceof msg.Nfsv4WriteRequest) {
        return `WRITE stateid = ${formatStateid(req.stateid, tab)}, offset = ${req.offset}, stable = ${(0, exports.formatNfsv4StableHow)(req.stable)}, length = ${req.data.length}`;
    }
    else if (req instanceof msg.Nfsv4ReleaseLockOwnerRequest) {
        return 'RELEASE_LOCKOWNER';
    }
    else if (req instanceof msg.Nfsv4IllegalRequest) {
        return 'ILLEGAL';
    }
    return 'Unknown Request';
};
exports.formatNfsv4Request = formatNfsv4Request;
const formatNfsv4Response = (res, tab = '') => {
    if (res instanceof msg.Nfsv4AccessResponse) {
        if (res.status === 0 && res.resok) {
            return `ACCESS (${(0, exports.formatNfsv4Stat)(res.status)}) supported = ${(0, exports.formatNfsv4Access)(res.resok.supported)}, access = ${(0, exports.formatNfsv4Access)(res.resok.access)}`;
        }
        return `ACCESS (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4CloseResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `stateid = ${formatStateid(res.resok.openStateid, tab)}`);
        }
        return `CLOSE (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4CommitResponse) {
        return `COMMIT (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4CreateResponse) {
        return `CREATE (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4DelegpurgeResponse) {
        return `DELEGPURGE (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4DelegreturnResponse) {
        return `DELEGRETURN (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4GetattrResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `attrs = ${(0, exports.formatNfsv4Bitmap)(res.resok.objAttributes.attrmask)}`);
        }
        return `GETATTR (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4GetfhResponse) {
        if (res.status === 0 && res.resok) {
            return `GETFH (${(0, exports.formatNfsv4Stat)(res.status)}) fh = ${formatFileHandle(res.resok.object)}`;
        }
        return `GETFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LinkResponse) {
        return `LINK (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LockResponse) {
        if (res.status === 0 && res.resok) {
            return `LOCK (${(0, exports.formatNfsv4Stat)(res.status)}) stateid = ${formatStateid(res.resok.lockStateid, tab)}`;
        }
        return `LOCK (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LocktResponse) {
        return `LOCKT (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LockuResponse) {
        if (res.status === 0 && res.resok) {
            return `LOCKU (${(0, exports.formatNfsv4Stat)(res.status)}) stateid = ${formatStateid(res.resok.lockStateid, tab)}`;
        }
        return `LOCKU (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LookupResponse) {
        return `LOOKUP (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4LookuppResponse) {
        return `LOOKUPP (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4NverifyResponse) {
        return `NVERIFY (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4OpenResponse) {
        if (res.status === 0 && res.resok) {
            return `OPEN (${(0, exports.formatNfsv4Stat)(res.status)}) stateid = ${formatStateid(res.resok.stateid, tab)}`;
        }
        return `OPEN (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4OpenattrResponse) {
        return `OPENATTR (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4OpenConfirmResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `stateid = ${formatStateid(res.resok.openStateid, tab)}`);
        }
        return `OPEN_CONFIRM (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4OpenDowngradeResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `stateid = ${formatStateid(res.resok.openStateid, tab)}`);
        }
        return `OPEN_DOWNGRADE (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4PutfhResponse) {
        return `PUTFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4PutpubfhResponse) {
        return `PUTPUBFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4PutrootfhResponse) {
        return `PUTROOTFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4ReadResponse) {
        if (res.status === 0 && res.resok) {
            return `READ (${(0, exports.formatNfsv4Stat)(res.status)}) eof = ${res.resok.eof}, length = ${res.resok.data.length}`;
        }
        return `READ (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4ReaddirResponse) {
        return `READDIR (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4ReadlinkResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `link = "${res.resok.link}"`);
        }
        return `READLINK (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4RemoveResponse) {
        return `REMOVE (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4RenameResponse) {
        return `RENAME (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4RenewResponse) {
        return `RENEW (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4RestorefhResponse) {
        return `RESTOREFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4SavefhResponse) {
        return `SAVEFH (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4SecinfoResponse) {
        return `SECINFO (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4SetattrResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `attrsset = ${(0, exports.formatNfsv4Bitmap)(res.resok.attrsset)}`);
        }
        return `SETATTR (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4SetclientidResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `clientid = ${res.resok.clientid}`);
        }
        return `SETCLIENTID (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4SetclientidConfirmResponse) {
        return `SETCLIENTID_CONFIRM (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4VerifyResponse) {
        return `VERIFY (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4WriteResponse) {
        const items = [];
        if (res.status === 0 && res.resok) {
            items.push((tab) => `count = ${res.resok.count}`);
            items.push((tab) => `committed = ${(0, exports.formatNfsv4StableHow)(res.resok.committed)}`);
        }
        return `WRITE (${(0, exports.formatNfsv4Stat)(res.status)})` + (0, printTree_1.printTree)(tab, items);
    }
    else if (res instanceof msg.Nfsv4ReleaseLockOwnerResponse) {
        return `RELEASE_LOCKOWNER (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    else if (res instanceof msg.Nfsv4IllegalResponse) {
        return `ILLEGAL (${(0, exports.formatNfsv4Stat)(res.status)})`;
    }
    return 'Unknown Response';
};
exports.formatNfsv4Response = formatNfsv4Response;
const formatNfsv4CompoundRequest = (req, tab = '') => {
    const items = [
        (tab) => `tag = "${req.tag}"`,
        (tab) => `minorversion = ${req.minorversion}`,
    ];
    req.argarray.forEach((op, i) => {
        items.push((tab) => `[${i}] ${(0, exports.formatNfsv4Request)(op, tab)}`);
    });
    return 'COMPOUND' + (0, printTree_1.printTree)(tab, items);
};
exports.formatNfsv4CompoundRequest = formatNfsv4CompoundRequest;
const formatNfsv4CompoundResponse = (res, tab = '') => {
    const items = [
        (tab) => `status = ${(0, exports.formatNfsv4Stat)(res.status)}`,
        (tab) => `tag = "${res.tag}"`,
    ];
    res.resarray.forEach((op, i) => {
        items.push((tab) => `[${i}] ${(0, exports.formatNfsv4Response)(op, tab)}`);
    });
    return 'COMPOUND' + (0, printTree_1.printTree)(tab, items);
};
exports.formatNfsv4CompoundResponse = formatNfsv4CompoundResponse;
//# sourceMappingURL=format.js.map