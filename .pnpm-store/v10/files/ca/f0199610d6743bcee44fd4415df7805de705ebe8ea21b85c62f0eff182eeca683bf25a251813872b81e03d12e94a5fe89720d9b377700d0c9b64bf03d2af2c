import type * as struct from '../../structs';
export declare class ByteRangeLock {
    readonly stateid: struct.Nfsv4Stateid;
    readonly path: string;
    readonly locktype: number;
    readonly offset: bigint;
    readonly length: bigint;
    readonly lockOwnerKey: string;
    constructor(stateid: struct.Nfsv4Stateid, path: string, locktype: number, offset: bigint, length: bigint, lockOwnerKey: string);
    overlaps(offset: bigint, length: bigint): boolean;
}
