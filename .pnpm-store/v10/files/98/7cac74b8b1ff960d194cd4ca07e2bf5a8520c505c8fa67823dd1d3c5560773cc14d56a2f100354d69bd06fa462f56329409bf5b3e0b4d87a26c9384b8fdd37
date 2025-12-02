import type * as misc from 'memfs/lib/node/types/misc';
import type { Nfsv4Client } from './types';
import * as msg from '../messages';
export declare class NfsFsDir implements misc.IDir {
    readonly path: string;
    private readonly nfs;
    private readonly operations;
    private entries;
    private position;
    private closed;
    constructor(path: string, nfs: Nfsv4Client, operations: msg.Nfsv4Request[]);
    private ensureLoaded;
    close(): Promise<void>;
    close(callback?: (err?: Error) => void): Promise<void>;
    closeSync(): void;
    read(): Promise<misc.IDirent | null>;
    read(callback?: (err: Error | null, dir?: misc.IDirent | null) => void): Promise<misc.IDirent | null>;
    readSync(): misc.IDirent | null;
    [Symbol.asyncIterator](): AsyncIterableIterator<misc.IDirent>;
}
