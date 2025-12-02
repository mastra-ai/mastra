import * as struct from '../../structs';
export declare class LockStateid {
    readonly other: Uint8Array;
    seqid: number;
    readonly lockOwnerKey: string;
    readonly path: string;
    constructor(other: Uint8Array, seqid: number, lockOwnerKey: string, path: string);
    toStateid(): struct.Nfsv4Stateid;
    incrementAndGetStateid(): struct.Nfsv4Stateid;
}
