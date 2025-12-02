import type { XdrDecoder, XdrEncoder, XdrType } from '../../xdr';
import type { Nfsv4FType, Nfsv4TimeHow, Nfsv4DelegType } from './constants';
export declare class Nfsv4Time implements XdrType {
    readonly seconds: bigint;
    readonly nseconds: number;
    constructor(seconds: bigint, nseconds: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SpecData implements XdrType {
    readonly specdata1: number;
    readonly specdata2: number;
    constructor(specdata1: number, specdata2: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Fh implements XdrType {
    readonly data: Uint8Array;
    constructor(data: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Verifier implements XdrType {
    readonly data: Uint8Array;
    constructor(data: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Fsid implements XdrType {
    readonly major: bigint;
    readonly minor: bigint;
    constructor(major: bigint, minor: bigint);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Stateid implements XdrType {
    readonly seqid: number;
    readonly other: Uint8Array;
    static decode(xdr: XdrDecoder): Nfsv4Stateid;
    constructor(seqid: number, other: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ChangeInfo implements XdrType {
    readonly atomic: boolean;
    readonly before: bigint;
    readonly after: bigint;
    constructor(atomic: boolean, before: bigint, after: bigint);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SetTime implements XdrType {
    readonly how: Nfsv4TimeHow;
    readonly time?: Nfsv4Time | undefined;
    constructor(how: Nfsv4TimeHow, time?: Nfsv4Time | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Bitmap implements XdrType {
    readonly mask: number[];
    constructor(mask: number[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Fattr implements XdrType {
    readonly attrmask: Nfsv4Bitmap;
    readonly attrVals: Uint8Array;
    constructor(attrmask: Nfsv4Bitmap, attrVals: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ClientAddr implements XdrType {
    readonly rNetid: string;
    readonly rAddr: string;
    constructor(rNetid: string, rAddr: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CbClient implements XdrType {
    readonly cbProgram: number;
    readonly cbLocation: Nfsv4ClientAddr;
    constructor(cbProgram: number, cbLocation: Nfsv4ClientAddr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4ClientId implements XdrType {
    readonly verifier: Nfsv4Verifier;
    readonly id: Uint8Array;
    constructor(verifier: Nfsv4Verifier, id: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenOwner implements XdrType {
    readonly clientid: bigint;
    readonly owner: Uint8Array;
    constructor(clientid: bigint, owner: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockOwner implements XdrType {
    readonly clientid: bigint;
    readonly owner: Uint8Array;
    constructor(clientid: bigint, owner: Uint8Array);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenToLockOwner implements XdrType {
    readonly openSeqid: number;
    readonly openStateid: Nfsv4Stateid;
    readonly lockSeqid: number;
    readonly lockOwner: Nfsv4LockOwner;
    constructor(openSeqid: number, openStateid: Nfsv4Stateid, lockSeqid: number, lockOwner: Nfsv4LockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4FsLocation implements XdrType {
    readonly server: string[];
    readonly rootpath: string[];
    constructor(server: string[], rootpath: string[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4FsLocations implements XdrType {
    readonly fsRoot: string[];
    readonly locations: Nfsv4FsLocation[];
    constructor(fsRoot: string[], locations: Nfsv4FsLocation[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Ace implements XdrType {
    readonly type: number;
    readonly flag: number;
    readonly accessMask: number;
    readonly who: string;
    constructor(type: number, flag: number, accessMask: number, who: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Acl implements XdrType {
    readonly aces: Nfsv4Ace[];
    constructor(aces: Nfsv4Ace[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SecInfo implements XdrType {
    readonly flavor: number;
    readonly flavorInfo?: Uint8Array | undefined;
    constructor(flavor: number, flavorInfo?: Uint8Array | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateAttrs implements XdrType {
    readonly createattrs: Nfsv4Fattr;
    constructor(createattrs: Nfsv4Fattr);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateVerf implements XdrType {
    readonly createverf: Nfsv4Verifier;
    constructor(createverf: Nfsv4Verifier);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateHow implements XdrType {
    readonly mode: number;
    readonly how?: Nfsv4CreateAttrs | Nfsv4CreateVerf | undefined;
    constructor(mode: number, how?: Nfsv4CreateAttrs | Nfsv4CreateVerf | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenHow implements XdrType {
    readonly opentype: number;
    readonly how?: Nfsv4CreateHow | undefined;
    constructor(opentype: number, how?: Nfsv4CreateHow | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenClaimNull implements XdrType {
    readonly file: string;
    constructor(file: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenClaimPrevious implements XdrType {
    readonly delegateType: Nfsv4DelegType;
    constructor(delegateType: Nfsv4DelegType);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenClaimDelegateCur implements XdrType {
    readonly delegateStateid: Nfsv4Stateid;
    readonly file: string;
    constructor(delegateStateid: Nfsv4Stateid, file: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenClaimDelegatePrev implements XdrType {
    readonly file: string;
    constructor(file: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenClaim implements XdrType {
    readonly claimType: number;
    readonly claim: Nfsv4OpenClaimNull | Nfsv4OpenClaimPrevious | Nfsv4OpenClaimDelegateCur | Nfsv4OpenClaimDelegatePrev;
    constructor(claimType: number, claim: Nfsv4OpenClaimNull | Nfsv4OpenClaimPrevious | Nfsv4OpenClaimDelegateCur | Nfsv4OpenClaimDelegatePrev);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenReadDelegation implements XdrType {
    readonly stateid: Nfsv4Stateid;
    readonly recall: boolean;
    readonly permissions: Nfsv4Ace[];
    constructor(stateid: Nfsv4Stateid, recall: boolean, permissions: Nfsv4Ace[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenWriteDelegation implements XdrType {
    readonly stateid: Nfsv4Stateid;
    readonly recall: boolean;
    readonly spaceLimit: bigint;
    readonly permissions: Nfsv4Ace[];
    constructor(stateid: Nfsv4Stateid, recall: boolean, spaceLimit: bigint, permissions: Nfsv4Ace[]);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4OpenDelegation implements XdrType {
    readonly delegationType: Nfsv4DelegType;
    readonly delegation?: Nfsv4OpenReadDelegation | Nfsv4OpenWriteDelegation | undefined;
    constructor(delegationType: Nfsv4DelegType, delegation?: Nfsv4OpenReadDelegation | Nfsv4OpenWriteDelegation | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4Entry implements XdrType {
    readonly cookie: bigint;
    readonly name: string;
    readonly attrs: Nfsv4Fattr;
    readonly nextEntry?: Nfsv4Entry | undefined;
    constructor(cookie: bigint, name: string, attrs: Nfsv4Fattr, nextEntry?: Nfsv4Entry | undefined);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockNewOwner implements XdrType {
    readonly openToLockOwner: Nfsv4OpenToLockOwner;
    constructor(openToLockOwner: Nfsv4OpenToLockOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockExistingOwner implements XdrType {
    readonly lockStateid: Nfsv4Stateid;
    readonly lockSeqid: number;
    constructor(lockStateid: Nfsv4Stateid, lockSeqid: number);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4LockOwnerInfo implements XdrType {
    readonly newLockOwner: boolean;
    readonly owner: Nfsv4LockNewOwner | Nfsv4LockExistingOwner;
    constructor(newLockOwner: boolean, owner: Nfsv4LockNewOwner | Nfsv4LockExistingOwner);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateTypeLink implements XdrType {
    readonly linkdata: string;
    constructor(linkdata: string);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateTypeDevice implements XdrType {
    readonly devdata: Nfsv4SpecData;
    constructor(devdata: Nfsv4SpecData);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateTypeVoid implements XdrType {
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4CreateType implements XdrType {
    readonly type: Nfsv4FType;
    readonly objtype: Nfsv4CreateTypeLink | Nfsv4CreateTypeDevice | Nfsv4CreateTypeVoid;
    constructor(type: Nfsv4FType, objtype: Nfsv4CreateTypeLink | Nfsv4CreateTypeDevice | Nfsv4CreateTypeVoid);
    encode(xdr: XdrEncoder): void;
}
export declare const enum Nfsv4RpcSecGssService {
    RPC_GSS_SVC_NONE = 1,
    RPC_GSS_SVC_INTEGRITY = 2,
    RPC_GSS_SVC_PRIVACY = 3
}
export declare class Nfsv4RpcSecGssInfo implements XdrType {
    readonly oid: Uint8Array;
    readonly qop: number;
    readonly service: Nfsv4RpcSecGssService;
    constructor(oid: Uint8Array, qop: number, service: Nfsv4RpcSecGssService);
    encode(xdr: XdrEncoder): void;
}
export declare class Nfsv4SecInfoFlavor implements XdrType {
    readonly flavor: number;
    readonly flavorInfo?: Nfsv4RpcSecGssInfo | undefined;
    constructor(flavor: number, flavorInfo?: Nfsv4RpcSecGssInfo | undefined);
    encode(xdr: XdrEncoder): void;
}
