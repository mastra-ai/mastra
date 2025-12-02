import { Nfsv4Stat, type Nfsv4LockType } from './constants';
import * as structs from './structs';
import type { XdrDecoder, XdrEncoder, XdrType } from '../../xdr';
export type Nfsv4Operation = Nfsv4Request | Nfsv4Response;
export type Nfsv4Request = Nfsv4AccessRequest | Nfsv4CloseRequest | Nfsv4CommitRequest | Nfsv4CreateRequest | Nfsv4DelegpurgeRequest | Nfsv4DelegreturnRequest | Nfsv4GetattrRequest | Nfsv4GetfhRequest | Nfsv4LinkRequest | Nfsv4LockRequest | Nfsv4LocktRequest | Nfsv4LockuRequest | Nfsv4LookupRequest | Nfsv4LookuppRequest | Nfsv4NverifyRequest | Nfsv4OpenRequest | Nfsv4OpenattrRequest | Nfsv4OpenConfirmRequest | Nfsv4OpenDowngradeRequest | Nfsv4PutfhRequest | Nfsv4PutpubfhRequest | Nfsv4PutrootfhRequest | Nfsv4ReadRequest | Nfsv4ReaddirRequest | Nfsv4ReadlinkRequest | Nfsv4RemoveRequest | Nfsv4RenameRequest | Nfsv4RenewRequest | Nfsv4RestorefhRequest | Nfsv4SavefhRequest | Nfsv4SecinfoRequest | Nfsv4SetattrRequest | Nfsv4SetclientidRequest | Nfsv4SetclientidConfirmRequest | Nfsv4VerifyRequest | Nfsv4WriteRequest | Nfsv4ReleaseLockOwnerRequest | Nfsv4IllegalRequest;
export type Nfsv4Response = Nfsv4AccessResponse | Nfsv4CloseResponse | Nfsv4CommitResponse | Nfsv4CreateResponse | Nfsv4DelegpurgeResponse | Nfsv4DelegreturnResponse | Nfsv4GetattrResponse | Nfsv4GetfhResponse | Nfsv4LinkResponse | Nfsv4LockResponse | Nfsv4LocktResponse | Nfsv4LockuResponse | Nfsv4LookupResponse | Nfsv4LookuppResponse | Nfsv4NverifyResponse | Nfsv4OpenResponse | Nfsv4OpenattrResponse | Nfsv4OpenConfirmResponse | Nfsv4OpenDowngradeResponse | Nfsv4PutfhResponse | Nfsv4PutpubfhResponse | Nfsv4PutrootfhResponse | Nfsv4ReadResponse | Nfsv4ReaddirResponse | Nfsv4ReadlinkResponse | Nfsv4RemoveResponse | Nfsv4RenameResponse | Nfsv4RenewResponse | Nfsv4RestorefhResponse | Nfsv4SavefhResponse | Nfsv4SecinfoResponse | Nfsv4SetattrResponse | Nfsv4SetclientidResponse | Nfsv4SetclientidConfirmResponse | Nfsv4VerifyResponse | Nfsv4WriteResponse | Nfsv4ReleaseLockOwnerResponse | Nfsv4IllegalResponse;
export declare class Nfsv4AccessRequest implements XdrType {
    readonly access: number;
    static decode(xdr: XdrDecoder): Nfsv4AccessRequest;
    constructor(access: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4AccessResOk {
    readonly supported: number;
    readonly access: number;
    constructor(supported: number, access: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4AccessResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4AccessResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4AccessResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CloseRequest {
    readonly seqid: number;
    readonly openStateid: structs.Nfsv4Stateid;
    static decode(xdr: XdrDecoder): Nfsv4CloseRequest;
    constructor(seqid: number, openStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CloseResOk {
    readonly openStateid: structs.Nfsv4Stateid;
    constructor(openStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CloseResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4CloseResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4CloseResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CommitRequest implements XdrType {
    readonly offset: bigint;
    readonly count: number;
    static decode(xdr: XdrDecoder): Nfsv4CommitRequest;
    constructor(offset: bigint, count: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CommitResOk {
    readonly writeverf: structs.Nfsv4Verifier;
    constructor(writeverf: structs.Nfsv4Verifier);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CommitResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4CommitResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4CommitResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateRequest implements XdrType {
    readonly objtype: structs.Nfsv4CreateType;
    readonly objname: string;
    readonly createattrs: structs.Nfsv4Fattr;
    constructor(objtype: structs.Nfsv4CreateType, objname: string, createattrs: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateResOk {
    readonly cinfo: structs.Nfsv4ChangeInfo;
    readonly attrset: structs.Nfsv4Bitmap;
    constructor(cinfo: structs.Nfsv4ChangeInfo, attrset: structs.Nfsv4Bitmap);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4CreateResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4CreateResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4DelegpurgeRequest implements XdrType {
    readonly clientid: bigint;
    static decode(xdr: XdrDecoder): Nfsv4DelegpurgeRequest;
    constructor(clientid: bigint);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4DelegpurgeResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4DelegreturnRequest implements XdrType {
    readonly delegStateid: structs.Nfsv4Stateid;
    static decode(xdr: XdrDecoder): Nfsv4DelegreturnRequest;
    constructor(delegStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4DelegreturnResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetattrRequest implements XdrType {
    readonly attrRequest: structs.Nfsv4Bitmap;
    constructor(attrRequest: structs.Nfsv4Bitmap);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetattrResOk {
    readonly objAttributes: structs.Nfsv4Fattr;
    constructor(objAttributes: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetattrResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4GetattrResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4GetattrResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetfhRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetfhResOk {
    readonly object: structs.Nfsv4Fh;
    constructor(object: structs.Nfsv4Fh);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4GetfhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4GetfhResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4GetfhResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LinkRequest implements XdrType {
    readonly newname: string;
    constructor(newname: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LinkResOk {
    readonly cinfo: structs.Nfsv4ChangeInfo;
    constructor(cinfo: structs.Nfsv4ChangeInfo);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LinkResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4LinkResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4LinkResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockRequest implements XdrType {
    readonly locktype: Nfsv4LockType;
    readonly reclaim: boolean;
    readonly offset: bigint;
    readonly length: bigint;
    readonly locker: structs.Nfsv4LockOwnerInfo;
    constructor(locktype: Nfsv4LockType, reclaim: boolean, offset: bigint, length: bigint, locker: structs.Nfsv4LockOwnerInfo);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockResOk {
    readonly lockStateid: structs.Nfsv4Stateid;
    constructor(lockStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockResDenied {
    readonly offset: bigint;
    readonly length: bigint;
    readonly locktype: Nfsv4LockType;
    readonly owner: structs.Nfsv4LockOwner;
    constructor(offset: bigint, length: bigint, locktype: Nfsv4LockType, owner: structs.Nfsv4LockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4LockResOk | undefined;
    readonly denied?: Nfsv4LockResDenied | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4LockResOk | undefined, denied?: Nfsv4LockResDenied | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LocktRequest implements XdrType {
    readonly locktype: Nfsv4LockType;
    readonly offset: bigint;
    readonly length: bigint;
    readonly owner: structs.Nfsv4LockOwner;
    constructor(locktype: Nfsv4LockType, offset: bigint, length: bigint, owner: structs.Nfsv4LockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LocktResDenied {
    readonly offset: bigint;
    readonly length: bigint;
    readonly locktype: Nfsv4LockType;
    readonly owner: structs.Nfsv4LockOwner;
    constructor(offset: bigint, length: bigint, locktype: Nfsv4LockType, owner: structs.Nfsv4LockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LocktResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly denied?: Nfsv4LocktResDenied | undefined;
    constructor(status: Nfsv4Stat, denied?: Nfsv4LocktResDenied | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockuRequest implements XdrType {
    readonly locktype: Nfsv4LockType;
    readonly seqid: number;
    readonly lockStateid: structs.Nfsv4Stateid;
    readonly offset: bigint;
    readonly length: bigint;
    constructor(locktype: Nfsv4LockType, seqid: number, lockStateid: structs.Nfsv4Stateid, offset: bigint, length: bigint);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockuResOk {
    readonly lockStateid: structs.Nfsv4Stateid;
    constructor(lockStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockuResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4LockuResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4LockuResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LookupRequest implements XdrType {
    readonly objname: string;
    constructor(objname: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LookupResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LookuppRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LookuppResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4NverifyRequest implements XdrType {
    readonly objAttributes: structs.Nfsv4Fattr;
    constructor(objAttributes: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4NverifyResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenRequest implements XdrType {
    readonly seqid: number;
    readonly shareAccess: number;
    readonly shareDeny: number;
    readonly owner: structs.Nfsv4OpenOwner;
    readonly openhow: structs.Nfsv4OpenHow;
    readonly claim: structs.Nfsv4OpenClaim;
    constructor(seqid: number, shareAccess: number, shareDeny: number, owner: structs.Nfsv4OpenOwner, openhow: structs.Nfsv4OpenHow, claim: structs.Nfsv4OpenClaim);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenResOk {
    readonly stateid: structs.Nfsv4Stateid;
    readonly cinfo: structs.Nfsv4ChangeInfo;
    readonly rflags: number;
    readonly attrset: structs.Nfsv4Bitmap;
    readonly delegation: structs.Nfsv4OpenDelegation;
    constructor(stateid: structs.Nfsv4Stateid, cinfo: structs.Nfsv4ChangeInfo, rflags: number, attrset: structs.Nfsv4Bitmap, delegation: structs.Nfsv4OpenDelegation);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4OpenResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4OpenResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenattrRequest implements XdrType {
    readonly createdir: boolean;
    constructor(createdir: boolean);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenattrResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenConfirmRequest implements XdrType {
    readonly openStateid: structs.Nfsv4Stateid;
    readonly seqid: number;
    constructor(openStateid: structs.Nfsv4Stateid, seqid: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenConfirmResOk {
    readonly openStateid: structs.Nfsv4Stateid;
    constructor(openStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenConfirmResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4OpenConfirmResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4OpenConfirmResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenDowngradeRequest implements XdrType {
    readonly openStateid: structs.Nfsv4Stateid;
    readonly seqid: number;
    readonly shareAccess: number;
    readonly shareDeny: number;
    constructor(openStateid: structs.Nfsv4Stateid, seqid: number, shareAccess: number, shareDeny: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenDowngradeResOk {
    readonly openStateid: structs.Nfsv4Stateid;
    constructor(openStateid: structs.Nfsv4Stateid);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenDowngradeResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4OpenDowngradeResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4OpenDowngradeResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutfhRequest implements XdrType {
    readonly object: structs.Nfsv4Fh;
    constructor(object: structs.Nfsv4Fh);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutfhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutpubfhRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutpubfhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    static decode(xdr: XdrDecoder): Nfsv4PutpubfhResponse;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutrootfhRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4PutrootfhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadRequest implements XdrType {
    readonly stateid: structs.Nfsv4Stateid;
    readonly offset: bigint;
    readonly count: number;
    constructor(stateid: structs.Nfsv4Stateid, offset: bigint, count: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadResOk {
    readonly eof: boolean;
    readonly data: Uint8Array;
    constructor(eof: boolean, data: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4ReadResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4ReadResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReaddirRequest implements XdrType {
    readonly cookie: bigint;
    readonly cookieverf: structs.Nfsv4Verifier;
    readonly dircount: number;
    readonly maxcount: number;
    readonly attrRequest: structs.Nfsv4Bitmap;
    constructor(cookie: bigint, cookieverf: structs.Nfsv4Verifier, dircount: number, maxcount: number, attrRequest: structs.Nfsv4Bitmap);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReaddirResOk {
    readonly cookieverf: structs.Nfsv4Verifier;
    readonly entries: structs.Nfsv4Entry[];
    readonly eof: boolean;
    constructor(cookieverf: structs.Nfsv4Verifier, entries: structs.Nfsv4Entry[], eof: boolean);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReaddirResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4ReaddirResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4ReaddirResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadlinkRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadlinkResOk {
    readonly link: string;
    constructor(link: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReadlinkResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4ReadlinkResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4ReadlinkResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RemoveRequest implements XdrType {
    readonly target: string;
    constructor(target: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RemoveResOk {
    readonly cinfo: structs.Nfsv4ChangeInfo;
    constructor(cinfo: structs.Nfsv4ChangeInfo);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RemoveResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4RemoveResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4RemoveResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RenameRequest implements XdrType {
    readonly oldname: string;
    readonly newname: string;
    constructor(oldname: string, newname: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RenameResOk {
    readonly sourceCinfo: structs.Nfsv4ChangeInfo;
    readonly targetCinfo: structs.Nfsv4ChangeInfo;
    constructor(sourceCinfo: structs.Nfsv4ChangeInfo, targetCinfo: structs.Nfsv4ChangeInfo);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RenameResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4RenameResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4RenameResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RenewRequest implements XdrType {
    readonly clientid: bigint;
    constructor(clientid: bigint);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RenewResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RestorefhRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4RestorefhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SavefhRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SavefhResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SecinfoRequest implements XdrType {
    readonly name: string;
    constructor(name: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SecinfoResOk {
    readonly flavors: structs.Nfsv4SecInfoFlavor[];
    constructor(flavors: structs.Nfsv4SecInfoFlavor[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SecinfoResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4SecinfoResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4SecinfoResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetattrRequest implements XdrType {
    readonly stateid: structs.Nfsv4Stateid;
    readonly objAttributes: structs.Nfsv4Fattr;
    constructor(stateid: structs.Nfsv4Stateid, objAttributes: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetattrResOk {
    readonly attrsset: structs.Nfsv4Bitmap;
    constructor(attrsset: structs.Nfsv4Bitmap);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetattrResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4SetattrResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4SetattrResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetclientidRequest implements XdrType {
    readonly client: structs.Nfsv4ClientId;
    readonly callback: structs.Nfsv4CbClient;
    readonly callbackIdent: number;
    constructor(client: structs.Nfsv4ClientId, callback: structs.Nfsv4CbClient, callbackIdent: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetclientidResOk {
    readonly clientid: bigint;
    readonly setclientidConfirm: structs.Nfsv4Verifier;
    constructor(clientid: bigint, setclientidConfirm: structs.Nfsv4Verifier);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetclientidResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4SetclientidResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4SetclientidResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetclientidConfirmRequest implements XdrType {
    readonly clientid: bigint;
    readonly setclientidConfirm: structs.Nfsv4Verifier;
    constructor(clientid: bigint, setclientidConfirm: structs.Nfsv4Verifier);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetclientidConfirmResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4VerifyRequest implements XdrType {
    readonly objAttributes: structs.Nfsv4Fattr;
    constructor(objAttributes: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4VerifyResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4WriteRequest implements XdrType {
    readonly stateid: structs.Nfsv4Stateid;
    readonly offset: bigint;
    readonly stable: number;
    readonly data: Uint8Array;
    constructor(stateid: structs.Nfsv4Stateid, offset: bigint, stable: number, data: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4WriteResOk {
    readonly count: number;
    readonly committed: number;
    readonly writeverf: structs.Nfsv4Verifier;
    constructor(count: number, committed: number, writeverf: structs.Nfsv4Verifier);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4WriteResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4WriteResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4WriteResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReleaseLockOwnerRequest implements XdrType {
    readonly lockOwner: structs.Nfsv4LockOwner;
    constructor(lockOwner: structs.Nfsv4LockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ReleaseLockOwnerResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4IllegalRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4IllegalResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CompoundRequest implements XdrType {
    readonly tag: string;
    readonly minorversion: number;
    readonly argarray: Nfsv4Request[];
    constructor(tag: string, minorversion: number, argarray: Nfsv4Request[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CompoundResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly tag: string;
    readonly resarray: Nfsv4Response[];
    constructor(status: Nfsv4Stat, tag: string, resarray: Nfsv4Response[]);
    encode(xdr: XdrEncoder): void;
}
export type Nfsv4CbOperation = Nfsv4CbRequest | Nfsv4CbResponse;
export type Nfsv4CbRequest = Nfsv4CbGetattrRequest | Nfsv4CbRecallRequest | Nfsv4CbIllegalRequest;
export type Nfsv4CbResponse = Nfsv4CbGetattrResponse | Nfsv4CbRecallResponse | Nfsv4CbIllegalResponse;
export declare class Nfsv4CbGetattrRequest implements XdrType {
    readonly fh: structs.Nfsv4Fh;
    readonly attrRequest: structs.Nfsv4Bitmap;
    constructor(fh: structs.Nfsv4Fh, attrRequest: structs.Nfsv4Bitmap);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbGetattrResOk {
    readonly objAttributes: structs.Nfsv4Fattr;
    constructor(objAttributes: structs.Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbGetattrResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly resok?: Nfsv4CbGetattrResOk | undefined;
    constructor(status: Nfsv4Stat, resok?: Nfsv4CbGetattrResOk | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbRecallRequest implements XdrType {
    readonly stateid: structs.Nfsv4Stateid;
    readonly truncate: boolean;
    readonly fh: structs.Nfsv4Fh;
    constructor(stateid: structs.Nfsv4Stateid, truncate: boolean, fh: structs.Nfsv4Fh);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbRecallResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbIllegalRequest implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbIllegalResponse implements XdrType {
    readonly status: Nfsv4Stat;
    constructor(status: Nfsv4Stat);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbCompoundRequest implements XdrType {
    readonly tag: string;
    readonly minorversion: number;
    readonly callbackIdent: number;
    readonly argarray: Nfsv4CbRequest[];
    constructor(tag: string, minorversion: number, callbackIdent: number, argarray: Nfsv4CbRequest[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbCompoundResponse implements XdrType {
    readonly status: Nfsv4Stat;
    readonly tag: string;
    readonly resarray: Nfsv4CbResponse[];
    constructor(status: Nfsv4Stat, tag: string, resarray: Nfsv4CbResponse[]);
    encode(xdr: XdrEncoder): void;
}
