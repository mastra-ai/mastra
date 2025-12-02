import type { Nfsv4OperationCtx } from '../Nfsv4Operations';
export declare const ROOT_FH: Uint8Array;
export declare const enum FH_TYPE {
    ROOT = 0,
    PATH = 1,
    ID = 2
}
export declare const enum FH {
    MAX_SIZE = 128
}
export declare const encodePathFh: (absolutePath: string) => Uint8Array | undefined;
export declare const decodePathFh: (fh: Uint8Array) => string | undefined;
export declare class FileHandleMapper {
    protected readonly dir: string;
    protected readonly stamp: number;
    protected idToPath: Map<number, string>;
    protected pathToId: Map<string, Uint8Array>;
    protected readonly maxFhTableSize = 100000;
    constructor(stamp: number, dir: string);
    decode(fh: Uint8Array): string;
    encode(path: string): Uint8Array;
    validate(fh: Uint8Array): boolean;
    currentPath(ctx: Nfsv4OperationCtx): string;
    savedPath(ctx: Nfsv4OperationCtx): string;
    setCfh(ctx: Nfsv4OperationCtx, path: string): void;
    remove(path: string): void;
    rename(oldPath: string, newPath: string): void;
}
