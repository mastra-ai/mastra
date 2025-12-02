import type { Nfsv3Stat } from './constants';
import type * as stucts from './structs';
export type Nfsv3Message = Nfsv3Request | Nfsv3Response;
export type Nfsv3Request = Nfsv3GetattrRequest | Nfsv3SetattrRequest | Nfsv3LookupRequest | Nfsv3AccessRequest | Nfsv3ReadlinkRequest | Nfsv3ReadRequest | Nfsv3WriteRequest | Nfsv3CreateRequest | Nfsv3MkdirRequest | Nfsv3SymlinkRequest | Nfsv3MknodRequest | Nfsv3RemoveRequest | Nfsv3RmdirRequest | Nfsv3RenameRequest | Nfsv3LinkRequest | Nfsv3ReaddirRequest | Nfsv3ReaddirplusRequest | Nfsv3FsstatRequest | Nfsv3FsinfoRequest | Nfsv3PathconfRequest | Nfsv3CommitRequest;
export type Nfsv3Response = Nfsv3GetattrResponse | Nfsv3SetattrResponse | Nfsv3LookupResponse | Nfsv3AccessResponse | Nfsv3ReadlinkResponse | Nfsv3ReadResponse | Nfsv3WriteResponse | Nfsv3CreateResponse | Nfsv3MkdirResponse | Nfsv3SymlinkResponse | Nfsv3MknodResponse | Nfsv3RemoveResponse | Nfsv3RmdirResponse | Nfsv3RenameResponse | Nfsv3LinkResponse | Nfsv3ReaddirResponse | Nfsv3ReaddirplusResponse | Nfsv3FsstatResponse | Nfsv3FsinfoResponse | Nfsv3PathconfResponse | Nfsv3CommitResponse;
export declare class Nfsv3GetattrRequest {
    readonly object: stucts.Nfsv3Fh;
    constructor(object: stucts.Nfsv3Fh);
}
export declare class Nfsv3GetattrResOk {
    readonly objAttributes: stucts.Nfsv3Fattr;
    constructor(objAttributes: stucts.Nfsv3Fattr);
}
export declare class Nfsv3GetattrResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3GetattrResOk | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3GetattrResOk | undefined);
}
export declare class Nfsv3SetattrRequest {
    readonly object: stucts.Nfsv3Fh;
    readonly newAttributes: stucts.Nfsv3Sattr;
    readonly guard: stucts.Nfsv3SattrGuard;
    constructor(object: stucts.Nfsv3Fh, newAttributes: stucts.Nfsv3Sattr, guard: stucts.Nfsv3SattrGuard);
}
export declare class Nfsv3SetattrResOk {
    readonly objWcc: stucts.Nfsv3WccData;
    constructor(objWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3SetattrResFail {
    readonly objWcc: stucts.Nfsv3WccData;
    constructor(objWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3SetattrResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3SetattrResOk | undefined;
    readonly resfail?: Nfsv3SetattrResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3SetattrResOk | undefined, resfail?: Nfsv3SetattrResFail | undefined);
}
export declare class Nfsv3LookupRequest {
    readonly what: stucts.Nfsv3DirOpArgs;
    constructor(what: stucts.Nfsv3DirOpArgs);
}
export declare class Nfsv3LookupResOk {
    readonly object: stucts.Nfsv3Fh;
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    constructor(object: stucts.Nfsv3Fh, objAttributes: stucts.Nfsv3PostOpAttr, dirAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3LookupResFail {
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    constructor(dirAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3LookupResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3LookupResOk | undefined;
    readonly resfail?: Nfsv3LookupResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3LookupResOk | undefined, resfail?: Nfsv3LookupResFail | undefined);
}
export declare class Nfsv3AccessRequest {
    readonly object: stucts.Nfsv3Fh;
    readonly access: number;
    constructor(object: stucts.Nfsv3Fh, access: number);
}
export declare class Nfsv3AccessResOk {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly access: number;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr, access: number);
}
export declare class Nfsv3AccessResFail {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3AccessResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3AccessResOk | undefined;
    readonly resfail?: Nfsv3AccessResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3AccessResOk | undefined, resfail?: Nfsv3AccessResFail | undefined);
}
export declare class Nfsv3ReadlinkRequest {
    readonly symlink: stucts.Nfsv3Fh;
    constructor(symlink: stucts.Nfsv3Fh);
}
export declare class Nfsv3ReadlinkResOk {
    readonly symlinkAttributes: stucts.Nfsv3PostOpAttr;
    readonly data: string;
    constructor(symlinkAttributes: stucts.Nfsv3PostOpAttr, data: string);
}
export declare class Nfsv3ReadlinkResFail {
    readonly symlinkAttributes: stucts.Nfsv3PostOpAttr;
    constructor(symlinkAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3ReadlinkResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3ReadlinkResOk | undefined;
    readonly resfail?: Nfsv3ReadlinkResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3ReadlinkResOk | undefined, resfail?: Nfsv3ReadlinkResFail | undefined);
}
export declare class Nfsv3ReadRequest {
    readonly file: stucts.Nfsv3Fh;
    readonly offset: bigint;
    readonly count: number;
    constructor(file: stucts.Nfsv3Fh, offset: bigint, count: number);
}
export declare class Nfsv3ReadResOk {
    readonly fileAttributes: stucts.Nfsv3PostOpAttr;
    readonly count: number;
    readonly eof: boolean;
    readonly data: Uint8Array;
    constructor(fileAttributes: stucts.Nfsv3PostOpAttr, count: number, eof: boolean, data: Uint8Array);
}
export declare class Nfsv3ReadResFail {
    readonly fileAttributes: stucts.Nfsv3PostOpAttr;
    constructor(fileAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3ReadResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3ReadResOk | undefined;
    readonly resfail?: Nfsv3ReadResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3ReadResOk | undefined, resfail?: Nfsv3ReadResFail | undefined);
}
export declare class Nfsv3WriteRequest {
    readonly file: stucts.Nfsv3Fh;
    readonly offset: bigint;
    readonly count: number;
    readonly stable: number;
    readonly data: Uint8Array;
    constructor(file: stucts.Nfsv3Fh, offset: bigint, count: number, stable: number, data: Uint8Array);
}
export declare class Nfsv3WriteResOk {
    readonly fileWcc: stucts.Nfsv3WccData;
    readonly count: number;
    readonly committed: number;
    readonly verf: Uint8Array;
    constructor(fileWcc: stucts.Nfsv3WccData, count: number, committed: number, verf: Uint8Array);
}
export declare class Nfsv3WriteResFail {
    readonly fileWcc: stucts.Nfsv3WccData;
    constructor(fileWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3WriteResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3WriteResOk | undefined;
    readonly resfail?: Nfsv3WriteResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3WriteResOk | undefined, resfail?: Nfsv3WriteResFail | undefined);
}
export declare class Nfsv3CreateRequest {
    readonly where: stucts.Nfsv3DirOpArgs;
    readonly how: stucts.Nfsv3CreateHow;
    constructor(where: stucts.Nfsv3DirOpArgs, how: stucts.Nfsv3CreateHow);
}
export declare class Nfsv3CreateResOk {
    readonly obj: stucts.Nfsv3PostOpFh;
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(obj: stucts.Nfsv3PostOpFh, objAttributes: stucts.Nfsv3PostOpAttr, dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3CreateResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3CreateResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3CreateResOk | undefined;
    readonly resfail?: Nfsv3CreateResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3CreateResOk | undefined, resfail?: Nfsv3CreateResFail | undefined);
}
export declare class Nfsv3MkdirRequest {
    readonly where: stucts.Nfsv3DirOpArgs;
    readonly attributes: stucts.Nfsv3Sattr;
    constructor(where: stucts.Nfsv3DirOpArgs, attributes: stucts.Nfsv3Sattr);
}
export declare class Nfsv3MkdirResOk {
    readonly obj: stucts.Nfsv3PostOpFh;
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(obj: stucts.Nfsv3PostOpFh, objAttributes: stucts.Nfsv3PostOpAttr, dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3MkdirResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3MkdirResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3MkdirResOk | undefined;
    readonly resfail?: Nfsv3MkdirResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3MkdirResOk | undefined, resfail?: Nfsv3MkdirResFail | undefined);
}
export declare class Nfsv3SymlinkRequest {
    readonly where: stucts.Nfsv3DirOpArgs;
    readonly symlinkAttributes: stucts.Nfsv3Sattr;
    readonly symlinkData: string;
    constructor(where: stucts.Nfsv3DirOpArgs, symlinkAttributes: stucts.Nfsv3Sattr, symlinkData: string);
}
export declare class Nfsv3SymlinkResOk {
    readonly obj: stucts.Nfsv3PostOpFh;
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(obj: stucts.Nfsv3PostOpFh, objAttributes: stucts.Nfsv3PostOpAttr, dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3SymlinkResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3SymlinkResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3SymlinkResOk | undefined;
    readonly resfail?: Nfsv3SymlinkResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3SymlinkResOk | undefined, resfail?: Nfsv3SymlinkResFail | undefined);
}
export declare class Nfsv3MknodRequest {
    readonly where: stucts.Nfsv3DirOpArgs;
    readonly what: stucts.Nfsv3MknodData;
    constructor(where: stucts.Nfsv3DirOpArgs, what: stucts.Nfsv3MknodData);
}
export declare class Nfsv3MknodResOk {
    readonly obj: stucts.Nfsv3PostOpFh;
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(obj: stucts.Nfsv3PostOpFh, objAttributes: stucts.Nfsv3PostOpAttr, dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3MknodResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3MknodResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3MknodResOk | undefined;
    readonly resfail?: Nfsv3MknodResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3MknodResOk | undefined, resfail?: Nfsv3MknodResFail | undefined);
}
export declare class Nfsv3RemoveRequest {
    readonly object: stucts.Nfsv3DirOpArgs;
    constructor(object: stucts.Nfsv3DirOpArgs);
}
export declare class Nfsv3RemoveResOk {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RemoveResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RemoveResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3RemoveResOk | undefined;
    readonly resfail?: Nfsv3RemoveResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3RemoveResOk | undefined, resfail?: Nfsv3RemoveResFail | undefined);
}
export declare class Nfsv3RmdirRequest {
    readonly object: stucts.Nfsv3DirOpArgs;
    constructor(object: stucts.Nfsv3DirOpArgs);
}
export declare class Nfsv3RmdirResOk {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RmdirResFail {
    readonly dirWcc: stucts.Nfsv3WccData;
    constructor(dirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RmdirResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3RmdirResOk | undefined;
    readonly resfail?: Nfsv3RmdirResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3RmdirResOk | undefined, resfail?: Nfsv3RmdirResFail | undefined);
}
export declare class Nfsv3RenameRequest {
    readonly from: stucts.Nfsv3DirOpArgs;
    readonly to: stucts.Nfsv3DirOpArgs;
    constructor(from: stucts.Nfsv3DirOpArgs, to: stucts.Nfsv3DirOpArgs);
}
export declare class Nfsv3RenameResOk {
    readonly fromDirWcc: stucts.Nfsv3WccData;
    readonly toDirWcc: stucts.Nfsv3WccData;
    constructor(fromDirWcc: stucts.Nfsv3WccData, toDirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RenameResFail {
    readonly fromDirWcc: stucts.Nfsv3WccData;
    readonly toDirWcc: stucts.Nfsv3WccData;
    constructor(fromDirWcc: stucts.Nfsv3WccData, toDirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3RenameResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3RenameResOk | undefined;
    readonly resfail?: Nfsv3RenameResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3RenameResOk | undefined, resfail?: Nfsv3RenameResFail | undefined);
}
export declare class Nfsv3LinkRequest {
    readonly file: stucts.Nfsv3Fh;
    readonly link: stucts.Nfsv3DirOpArgs;
    constructor(file: stucts.Nfsv3Fh, link: stucts.Nfsv3DirOpArgs);
}
export declare class Nfsv3LinkResOk {
    readonly fileAttributes: stucts.Nfsv3PostOpAttr;
    readonly linkDirWcc: stucts.Nfsv3WccData;
    constructor(fileAttributes: stucts.Nfsv3PostOpAttr, linkDirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3LinkResFail {
    readonly fileAttributes: stucts.Nfsv3PostOpAttr;
    readonly linkDirWcc: stucts.Nfsv3WccData;
    constructor(fileAttributes: stucts.Nfsv3PostOpAttr, linkDirWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3LinkResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3LinkResOk | undefined;
    readonly resfail?: Nfsv3LinkResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3LinkResOk | undefined, resfail?: Nfsv3LinkResFail | undefined);
}
export declare class Nfsv3ReaddirRequest {
    readonly dir: stucts.Nfsv3Fh;
    readonly cookie: bigint;
    readonly cookieverf: Uint8Array;
    readonly count: number;
    constructor(dir: stucts.Nfsv3Fh, cookie: bigint, cookieverf: Uint8Array, count: number);
}
export declare class Nfsv3ReaddirResOk {
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    readonly cookieverf: Uint8Array;
    readonly reply: stucts.Nfsv3DirList;
    constructor(dirAttributes: stucts.Nfsv3PostOpAttr, cookieverf: Uint8Array, reply: stucts.Nfsv3DirList);
}
export declare class Nfsv3ReaddirResFail {
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    constructor(dirAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3ReaddirResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3ReaddirResOk | undefined;
    readonly resfail?: Nfsv3ReaddirResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3ReaddirResOk | undefined, resfail?: Nfsv3ReaddirResFail | undefined);
}
export declare class Nfsv3ReaddirplusRequest {
    readonly dir: stucts.Nfsv3Fh;
    readonly cookie: bigint;
    readonly cookieverf: Uint8Array;
    readonly dircount: number;
    readonly maxcount: number;
    constructor(dir: stucts.Nfsv3Fh, cookie: bigint, cookieverf: Uint8Array, dircount: number, maxcount: number);
}
export declare class Nfsv3ReaddirplusResOk {
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    readonly cookieverf: Uint8Array;
    readonly reply: stucts.Nfsv3DirListPlus;
    constructor(dirAttributes: stucts.Nfsv3PostOpAttr, cookieverf: Uint8Array, reply: stucts.Nfsv3DirListPlus);
}
export declare class Nfsv3ReaddirplusResFail {
    readonly dirAttributes: stucts.Nfsv3PostOpAttr;
    constructor(dirAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3ReaddirplusResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3ReaddirplusResOk | undefined;
    readonly resfail?: Nfsv3ReaddirplusResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3ReaddirplusResOk | undefined, resfail?: Nfsv3ReaddirplusResFail | undefined);
}
export declare class Nfsv3FsstatRequest {
    readonly fsroot: stucts.Nfsv3Fh;
    constructor(fsroot: stucts.Nfsv3Fh);
}
export declare class Nfsv3FsstatResOk {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly tbytes: bigint;
    readonly fbytes: bigint;
    readonly abytes: bigint;
    readonly tfiles: bigint;
    readonly ffiles: bigint;
    readonly afiles: bigint;
    readonly invarsec: number;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr, tbytes: bigint, fbytes: bigint, abytes: bigint, tfiles: bigint, ffiles: bigint, afiles: bigint, invarsec: number);
}
export declare class Nfsv3FsstatResFail {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3FsstatResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3FsstatResOk | undefined;
    readonly resfail?: Nfsv3FsstatResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3FsstatResOk | undefined, resfail?: Nfsv3FsstatResFail | undefined);
}
export declare class Nfsv3FsinfoRequest {
    readonly fsroot: stucts.Nfsv3Fh;
    constructor(fsroot: stucts.Nfsv3Fh);
}
export declare class Nfsv3FsinfoResOk {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly rtmax: number;
    readonly rtpref: number;
    readonly rtmult: number;
    readonly wtmax: number;
    readonly wtpref: number;
    readonly wtmult: number;
    readonly dtpref: number;
    readonly maxfilesize: bigint;
    readonly timeDelta: {
        seconds: number;
        nseconds: number;
    };
    readonly properties: number;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr, rtmax: number, rtpref: number, rtmult: number, wtmax: number, wtpref: number, wtmult: number, dtpref: number, maxfilesize: bigint, timeDelta: {
        seconds: number;
        nseconds: number;
    }, properties: number);
}
export declare class Nfsv3FsinfoResFail {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3FsinfoResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3FsinfoResOk | undefined;
    readonly resfail?: Nfsv3FsinfoResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3FsinfoResOk | undefined, resfail?: Nfsv3FsinfoResFail | undefined);
}
export declare class Nfsv3PathconfRequest {
    readonly object: stucts.Nfsv3Fh;
    constructor(object: stucts.Nfsv3Fh);
}
export declare class Nfsv3PathconfResOk {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    readonly linkmax: number;
    readonly namemax: number;
    readonly noTrunc: boolean;
    readonly chownRestricted: boolean;
    readonly caseInsensitive: boolean;
    readonly casePreserving: boolean;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr, linkmax: number, namemax: number, noTrunc: boolean, chownRestricted: boolean, caseInsensitive: boolean, casePreserving: boolean);
}
export declare class Nfsv3PathconfResFail {
    readonly objAttributes: stucts.Nfsv3PostOpAttr;
    constructor(objAttributes: stucts.Nfsv3PostOpAttr);
}
export declare class Nfsv3PathconfResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3PathconfResOk | undefined;
    readonly resfail?: Nfsv3PathconfResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3PathconfResOk | undefined, resfail?: Nfsv3PathconfResFail | undefined);
}
export declare class Nfsv3CommitRequest {
    readonly file: stucts.Nfsv3Fh;
    readonly offset: bigint;
    readonly count: number;
    constructor(file: stucts.Nfsv3Fh, offset: bigint, count: number);
}
export declare class Nfsv3CommitResOk {
    readonly fileWcc: stucts.Nfsv3WccData;
    readonly verf: Uint8Array;
    constructor(fileWcc: stucts.Nfsv3WccData, verf: Uint8Array);
}
export declare class Nfsv3CommitResFail {
    readonly fileWcc: stucts.Nfsv3WccData;
    constructor(fileWcc: stucts.Nfsv3WccData);
}
export declare class Nfsv3CommitResponse {
    readonly status: Nfsv3Stat;
    readonly resok?: Nfsv3CommitResOk | undefined;
    readonly resfail?: Nfsv3CommitResFail | undefined;
    constructor(status: Nfsv3Stat, resok?: Nfsv3CommitResOk | undefined, resfail?: Nfsv3CommitResFail | undefined);
}
