/// <reference types="node" />
import type * as struct from '../../structs';
import type { FileHandle } from 'node:fs/promises';
export declare class OpenFileState {
    readonly stateid: struct.Nfsv4Stateid;
    readonly path: string;
    readonly fd: FileHandle;
    shareAccess: number;
    shareDeny: number;
    readonly openOwnerKey: string;
    seqid: number;
    confirmed: boolean;
    constructor(stateid: struct.Nfsv4Stateid, path: string, fd: FileHandle, shareAccess: number, shareDeny: number, openOwnerKey: string, seqid: number, confirmed: boolean);
}
