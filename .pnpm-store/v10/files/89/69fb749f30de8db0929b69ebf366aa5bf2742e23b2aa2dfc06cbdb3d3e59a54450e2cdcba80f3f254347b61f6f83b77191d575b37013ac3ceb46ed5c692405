import type { Nfsv3FType, Nfsv3TimeHow, Nfsv3StableHow, Nfsv3CreateMode } from './constants';
export declare class Nfsv3Time {
    readonly seconds: number;
    readonly nseconds: number;
    constructor(seconds: number, nseconds: number);
}
export declare class Nfsv3SpecData {
    readonly specdata1: number;
    readonly specdata2: number;
    constructor(specdata1: number, specdata2: number);
}
export declare class Nfsv3Fh {
    readonly data: Uint8Array;
    constructor(data: Uint8Array);
}
export declare class Nfsv3SetMode {
    readonly set: boolean;
    readonly mode?: number | undefined;
    constructor(set: boolean, mode?: number | undefined);
}
export declare class Nfsv3SetUid {
    readonly set: boolean;
    readonly uid?: number | undefined;
    constructor(set: boolean, uid?: number | undefined);
}
export declare class Nfsv3SetGid {
    readonly set: boolean;
    readonly gid?: number | undefined;
    constructor(set: boolean, gid?: number | undefined);
}
export declare class Nfsv3SetSize {
    readonly set: boolean;
    readonly size?: bigint | undefined;
    constructor(set: boolean, size?: bigint | undefined);
}
export declare class Nfsv3SetAtime {
    readonly how: Nfsv3TimeHow;
    readonly atime?: Nfsv3Time | undefined;
    constructor(how: Nfsv3TimeHow, atime?: Nfsv3Time | undefined);
}
export declare class Nfsv3SetMtime {
    readonly how: Nfsv3TimeHow;
    readonly mtime?: Nfsv3Time | undefined;
    constructor(how: Nfsv3TimeHow, mtime?: Nfsv3Time | undefined);
}
export declare class Nfsv3Sattr {
    readonly mode: Nfsv3SetMode;
    readonly uid: Nfsv3SetUid;
    readonly gid: Nfsv3SetGid;
    readonly size: Nfsv3SetSize;
    readonly atime: Nfsv3SetAtime;
    readonly mtime: Nfsv3SetMtime;
    constructor(mode: Nfsv3SetMode, uid: Nfsv3SetUid, gid: Nfsv3SetGid, size: Nfsv3SetSize, atime: Nfsv3SetAtime, mtime: Nfsv3SetMtime);
}
export declare class Nfsv3SattrGuard {
    readonly check: boolean;
    readonly objCtime?: Nfsv3Time | undefined;
    constructor(check: boolean, objCtime?: Nfsv3Time | undefined);
}
export declare class Nfsv3DirOpArgs {
    readonly dir: Nfsv3Fh;
    readonly name: string;
    constructor(dir: Nfsv3Fh, name: string);
}
export declare class Nfsv3WccAttr {
    readonly size: bigint;
    readonly mtime: Nfsv3Time;
    readonly ctime: Nfsv3Time;
    constructor(size: bigint, mtime: Nfsv3Time, ctime: Nfsv3Time);
}
export declare class Nfsv3PreOpAttr {
    readonly attributesFollow: boolean;
    readonly attributes?: Nfsv3WccAttr | undefined;
    constructor(attributesFollow: boolean, attributes?: Nfsv3WccAttr | undefined);
}
export declare class Nfsv3PostOpAttr {
    readonly attributesFollow: boolean;
    readonly attributes?: Nfsv3Fattr | undefined;
    constructor(attributesFollow: boolean, attributes?: Nfsv3Fattr | undefined);
}
export declare class Nfsv3PostOpFh {
    readonly handleFollows: boolean;
    readonly handle?: Nfsv3Fh | undefined;
    constructor(handleFollows: boolean, handle?: Nfsv3Fh | undefined);
}
export declare class Nfsv3WccData {
    readonly before: Nfsv3PreOpAttr;
    readonly after: Nfsv3PostOpAttr;
    constructor(before: Nfsv3PreOpAttr, after: Nfsv3PostOpAttr);
}
export declare class Nfsv3Fattr {
    readonly type: Nfsv3FType;
    readonly mode: number;
    readonly nlink: number;
    readonly uid: number;
    readonly gid: number;
    readonly size: bigint;
    readonly used: bigint;
    readonly rdev: Nfsv3SpecData;
    readonly fsid: bigint;
    readonly fileid: bigint;
    readonly atime: Nfsv3Time;
    readonly mtime: Nfsv3Time;
    readonly ctime: Nfsv3Time;
    constructor(type: Nfsv3FType, mode: number, nlink: number, uid: number, gid: number, size: bigint, used: bigint, rdev: Nfsv3SpecData, fsid: bigint, fileid: bigint, atime: Nfsv3Time, mtime: Nfsv3Time, ctime: Nfsv3Time);
}
export declare class Nfsv3DeviceData {
    readonly devAttributes: Nfsv3Sattr;
    readonly spec: Nfsv3SpecData;
    constructor(devAttributes: Nfsv3Sattr, spec: Nfsv3SpecData);
}
export declare class Nfsv3MknodData {
    readonly type: Nfsv3FType;
    readonly chr?: Nfsv3DeviceData | undefined;
    readonly blk?: Nfsv3DeviceData | undefined;
    readonly sock?: Nfsv3Sattr | undefined;
    readonly pipe?: Nfsv3Sattr | undefined;
    constructor(type: Nfsv3FType, chr?: Nfsv3DeviceData | undefined, blk?: Nfsv3DeviceData | undefined, sock?: Nfsv3Sattr | undefined, pipe?: Nfsv3Sattr | undefined);
}
export declare class Nfsv3CreateHow {
    readonly mode: Nfsv3CreateMode;
    readonly objAttributes?: Nfsv3Sattr | undefined;
    readonly verf?: Uint8Array | undefined;
    constructor(mode: Nfsv3CreateMode, objAttributes?: Nfsv3Sattr | undefined, verf?: Uint8Array | undefined);
}
export declare class Nfsv3WriteHow {
    readonly stable: Nfsv3StableHow;
    constructor(stable: Nfsv3StableHow);
}
export declare class Nfsv3Entry {
    readonly fileid: bigint;
    readonly name: string;
    readonly cookie: bigint;
    readonly nextentry?: Nfsv3Entry | undefined;
    constructor(fileid: bigint, name: string, cookie: bigint, nextentry?: Nfsv3Entry | undefined);
}
export declare class Nfsv3EntryPlus {
    readonly fileid: bigint;
    readonly name: string;
    readonly cookie: bigint;
    readonly nameAttributes: Nfsv3PostOpAttr;
    readonly nameHandle: Nfsv3PostOpFh;
    readonly nextentry?: Nfsv3EntryPlus | undefined;
    constructor(fileid: bigint, name: string, cookie: bigint, nameAttributes: Nfsv3PostOpAttr, nameHandle: Nfsv3PostOpFh, nextentry?: Nfsv3EntryPlus | undefined);
}
export declare class Nfsv3DirList {
    readonly eof: boolean;
    readonly entries?: Nfsv3Entry | undefined;
    constructor(eof: boolean, entries?: Nfsv3Entry | undefined);
}
export declare class Nfsv3DirListPlus {
    readonly eof: boolean;
    readonly entries?: Nfsv3EntryPlus | undefined;
    constructor(eof: boolean, entries?: Nfsv3EntryPlus | undefined);
}
