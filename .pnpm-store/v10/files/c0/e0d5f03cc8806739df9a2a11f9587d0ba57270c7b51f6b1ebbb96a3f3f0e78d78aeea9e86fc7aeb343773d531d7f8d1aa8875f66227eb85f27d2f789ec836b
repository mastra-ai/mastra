"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv3DirListPlus = exports.Nfsv3DirList = exports.Nfsv3EntryPlus = exports.Nfsv3Entry = exports.Nfsv3WriteHow = exports.Nfsv3CreateHow = exports.Nfsv3MknodData = exports.Nfsv3DeviceData = exports.Nfsv3Fattr = exports.Nfsv3WccData = exports.Nfsv3PostOpFh = exports.Nfsv3PostOpAttr = exports.Nfsv3PreOpAttr = exports.Nfsv3WccAttr = exports.Nfsv3DirOpArgs = exports.Nfsv3SattrGuard = exports.Nfsv3Sattr = exports.Nfsv3SetMtime = exports.Nfsv3SetAtime = exports.Nfsv3SetSize = exports.Nfsv3SetGid = exports.Nfsv3SetUid = exports.Nfsv3SetMode = exports.Nfsv3Fh = exports.Nfsv3SpecData = exports.Nfsv3Time = void 0;
class Nfsv3Time {
    constructor(seconds, nseconds) {
        this.seconds = seconds;
        this.nseconds = nseconds;
    }
}
exports.Nfsv3Time = Nfsv3Time;
class Nfsv3SpecData {
    constructor(specdata1, specdata2) {
        this.specdata1 = specdata1;
        this.specdata2 = specdata2;
    }
}
exports.Nfsv3SpecData = Nfsv3SpecData;
class Nfsv3Fh {
    constructor(data) {
        this.data = data;
    }
}
exports.Nfsv3Fh = Nfsv3Fh;
class Nfsv3SetMode {
    constructor(set, mode) {
        this.set = set;
        this.mode = mode;
    }
}
exports.Nfsv3SetMode = Nfsv3SetMode;
class Nfsv3SetUid {
    constructor(set, uid) {
        this.set = set;
        this.uid = uid;
    }
}
exports.Nfsv3SetUid = Nfsv3SetUid;
class Nfsv3SetGid {
    constructor(set, gid) {
        this.set = set;
        this.gid = gid;
    }
}
exports.Nfsv3SetGid = Nfsv3SetGid;
class Nfsv3SetSize {
    constructor(set, size) {
        this.set = set;
        this.size = size;
    }
}
exports.Nfsv3SetSize = Nfsv3SetSize;
class Nfsv3SetAtime {
    constructor(how, atime) {
        this.how = how;
        this.atime = atime;
    }
}
exports.Nfsv3SetAtime = Nfsv3SetAtime;
class Nfsv3SetMtime {
    constructor(how, mtime) {
        this.how = how;
        this.mtime = mtime;
    }
}
exports.Nfsv3SetMtime = Nfsv3SetMtime;
class Nfsv3Sattr {
    constructor(mode, uid, gid, size, atime, mtime) {
        this.mode = mode;
        this.uid = uid;
        this.gid = gid;
        this.size = size;
        this.atime = atime;
        this.mtime = mtime;
    }
}
exports.Nfsv3Sattr = Nfsv3Sattr;
class Nfsv3SattrGuard {
    constructor(check, objCtime) {
        this.check = check;
        this.objCtime = objCtime;
    }
}
exports.Nfsv3SattrGuard = Nfsv3SattrGuard;
class Nfsv3DirOpArgs {
    constructor(dir, name) {
        this.dir = dir;
        this.name = name;
    }
}
exports.Nfsv3DirOpArgs = Nfsv3DirOpArgs;
class Nfsv3WccAttr {
    constructor(size, mtime, ctime) {
        this.size = size;
        this.mtime = mtime;
        this.ctime = ctime;
    }
}
exports.Nfsv3WccAttr = Nfsv3WccAttr;
class Nfsv3PreOpAttr {
    constructor(attributesFollow, attributes) {
        this.attributesFollow = attributesFollow;
        this.attributes = attributes;
    }
}
exports.Nfsv3PreOpAttr = Nfsv3PreOpAttr;
class Nfsv3PostOpAttr {
    constructor(attributesFollow, attributes) {
        this.attributesFollow = attributesFollow;
        this.attributes = attributes;
    }
}
exports.Nfsv3PostOpAttr = Nfsv3PostOpAttr;
class Nfsv3PostOpFh {
    constructor(handleFollows, handle) {
        this.handleFollows = handleFollows;
        this.handle = handle;
    }
}
exports.Nfsv3PostOpFh = Nfsv3PostOpFh;
class Nfsv3WccData {
    constructor(before, after) {
        this.before = before;
        this.after = after;
    }
}
exports.Nfsv3WccData = Nfsv3WccData;
class Nfsv3Fattr {
    constructor(type, mode, nlink, uid, gid, size, used, rdev, fsid, fileid, atime, mtime, ctime) {
        this.type = type;
        this.mode = mode;
        this.nlink = nlink;
        this.uid = uid;
        this.gid = gid;
        this.size = size;
        this.used = used;
        this.rdev = rdev;
        this.fsid = fsid;
        this.fileid = fileid;
        this.atime = atime;
        this.mtime = mtime;
        this.ctime = ctime;
    }
}
exports.Nfsv3Fattr = Nfsv3Fattr;
class Nfsv3DeviceData {
    constructor(devAttributes, spec) {
        this.devAttributes = devAttributes;
        this.spec = spec;
    }
}
exports.Nfsv3DeviceData = Nfsv3DeviceData;
class Nfsv3MknodData {
    constructor(type, chr, blk, sock, pipe) {
        this.type = type;
        this.chr = chr;
        this.blk = blk;
        this.sock = sock;
        this.pipe = pipe;
    }
}
exports.Nfsv3MknodData = Nfsv3MknodData;
class Nfsv3CreateHow {
    constructor(mode, objAttributes, verf) {
        this.mode = mode;
        this.objAttributes = objAttributes;
        this.verf = verf;
    }
}
exports.Nfsv3CreateHow = Nfsv3CreateHow;
class Nfsv3WriteHow {
    constructor(stable) {
        this.stable = stable;
    }
}
exports.Nfsv3WriteHow = Nfsv3WriteHow;
class Nfsv3Entry {
    constructor(fileid, name, cookie, nextentry) {
        this.fileid = fileid;
        this.name = name;
        this.cookie = cookie;
        this.nextentry = nextentry;
    }
}
exports.Nfsv3Entry = Nfsv3Entry;
class Nfsv3EntryPlus {
    constructor(fileid, name, cookie, nameAttributes, nameHandle, nextentry) {
        this.fileid = fileid;
        this.name = name;
        this.cookie = cookie;
        this.nameAttributes = nameAttributes;
        this.nameHandle = nameHandle;
        this.nextentry = nextentry;
    }
}
exports.Nfsv3EntryPlus = Nfsv3EntryPlus;
class Nfsv3DirList {
    constructor(eof, entries) {
        this.eof = eof;
        this.entries = entries;
    }
}
exports.Nfsv3DirList = Nfsv3DirList;
class Nfsv3DirListPlus {
    constructor(eof, entries) {
        this.eof = eof;
        this.entries = entries;
    }
}
exports.Nfsv3DirListPlus = Nfsv3DirListPlus;
//# sourceMappingURL=structs.js.map