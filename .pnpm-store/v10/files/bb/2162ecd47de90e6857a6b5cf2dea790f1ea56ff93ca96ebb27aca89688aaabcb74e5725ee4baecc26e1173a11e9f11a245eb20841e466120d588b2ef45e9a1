/// <reference types="node" />
/// <reference types="node" />
import { EventEmitter } from 'events';
import * as structs from '../structs';
import type * as misc from 'memfs/lib/node/types/misc';
import type * as opts from 'memfs/lib/node/types/options';
import type { Nfsv4FsClient } from './Nfsv4FsClient';
export declare class NfsFsFileHandle extends EventEmitter implements misc.IFileHandle {
    readonly path: string;
    private readonly client;
    private readonly stateid;
    private readonly openOwner;
    readonly fd: number;
    private closed;
    constructor(fd: number, path: string, client: Nfsv4FsClient, stateid: structs.Nfsv4Stateid, openOwner: structs.Nfsv4OpenOwner);
    getAsyncId(): number;
    close(): Promise<void>;
    stat(options?: opts.IStatOptions): Promise<misc.IStats>;
    appendFile(data: misc.TData, options?: opts.IAppendFileOptions | string): Promise<void>;
    chmod(mode: misc.TMode): Promise<void>;
    chown(uid: number, gid: number): Promise<void>;
    datasync(): Promise<void>;
    read(buffer: Buffer | Uint8Array, offset: number, length: number, position?: number | null): Promise<misc.TFileHandleReadResult>;
    readFile(options?: opts.IReadFileOptions | string): Promise<misc.TDataOut>;
    truncate(len?: number): Promise<void>;
    utimes(atime: misc.TTime, mtime: misc.TTime): Promise<void>;
    write(buffer: Buffer | ArrayBufferView | DataView, offset?: number, length?: number, position?: number | null): Promise<misc.TFileHandleWriteResult>;
    writeFile(data: misc.TData, options?: opts.IWriteFileOptions): Promise<void>;
    readv(buffers: ArrayBufferView[], position?: number | null): Promise<misc.TFileHandleReadvResult>;
    writev(buffers: ArrayBufferView[], position?: number | null): Promise<misc.TFileHandleWritevResult>;
    readableWebStream(options?: opts.IReadableWebStreamOptions): ReadableStream;
    createReadStream(options?: opts.IFileHandleReadStreamOptions): misc.IReadStream;
    createWriteStream(options?: opts.IFileHandleWriteStreamOptions): misc.IWriteStream;
}
