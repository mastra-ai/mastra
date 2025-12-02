/// <reference types="node" />
/// <reference types="node" />
import stdFs, { Dirent, Mode, ReadStream, Stats } from "fs";
import { Readable } from "stream";
export type NormalizedPath = string;
export interface Filesystem {
    listDir(dirPath: string): Dirent[];
    exists(path: string): boolean;
    stat(path: string): Stats;
    readUtf8File(path: string): string;
    createReadStream(path: string, options: {
        highWaterMark?: number;
    }): ReadStream;
    access(path: string): void;
    writeUtf8File(path: string, contents: string, mode?: Mode): void;
    mkdir(dirPath: string, options?: {
        allowExisting?: boolean;
        recursive?: boolean;
    }): void;
    rmdir(path: string): void;
    unlink(path: string): void;
    swapTmpFile(fromPath: TempPath, toPath: string): void;
    registerPath(path: string, st: Stats | null): void;
    invalidate(): void;
}
export type TempPath = string & {
    __tempPath: "tempPath";
};
export interface TempDir {
    writeUtf8File(contents: string): TempPath;
    writeFileStream(path: TempPath, stream: Readable, onData?: (chunk: any) => void): Promise<void>;
    registerTempPath(st: Stats | null): TempPath;
    path: TempPath;
}
export declare function withTmpDir(callback: (tmpDir: TempDir) => Promise<void>): Promise<void>;
export declare class NodeFs implements Filesystem {
    listDir(dirPath: string): stdFs.Dirent<string>[];
    exists(path: string): boolean;
    stat(path: string): stdFs.Stats;
    readUtf8File(path: string): string;
    createReadStream(path: string, options: {
        highWaterMark?: number;
    }): ReadStream;
    writeFileStream(path: string, stream: Readable, onData?: (chunk: any) => void): Promise<void>;
    access(path: string): void;
    writeUtf8File(path: string, contents: string, mode?: Mode): void;
    mkdir(dirPath: string, options?: {
        allowExisting?: boolean;
        recursive?: boolean;
    }): void;
    rmdir(path: string): void;
    unlink(path: string): void;
    swapTmpFile(fromPath: TempPath, toPath: string): void;
    registerPath(_path: string, _st: Stats | null): void;
    invalidate(): void;
}
export declare const nodeFs: NodeFs;
export declare class RecordingFs implements Filesystem {
    private observedDirectories;
    private observedFiles;
    private invalidated;
    private traceEvents;
    constructor(traceEvents: boolean);
    listDir(dirPath: string): Dirent[];
    exists(path: string): boolean;
    stat(path: string): Stats;
    readUtf8File(path: string): string;
    createReadStream(path: string, options: {
        highWaterMark?: number;
    }): ReadStream;
    access(path: string): void;
    writeUtf8File(filePath: string, contents: string, mode?: Mode): void;
    mkdir(dirPath: string, options?: {
        allowExisting?: boolean;
        recursive?: boolean;
    }): void;
    rmdir(dirPath: string): void;
    unlink(filePath: string): void;
    swapTmpFile(fromPath: TempPath, toPath: string): void;
    private updateOnWrite;
    private updateOnDelete;
    registerPath(p: string, st: Stats | null): void;
    invalidate(): void;
    registerNormalized(absPath: string, observed: Stats | null): void;
    finalize(): Observations | "invalidated";
}
export type WatchEvent = {
    name: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
    absPath: string;
};
export declare class Observations {
    directories: Map<string, Set<string>>;
    files: Map<string, Stats | null>;
    constructor(directories: Map<string, Set<string>>, files: Map<string, Stats | null>);
    paths(): string[];
    overlaps({ absPath, }: WatchEvent): {
        overlaps: false;
    } | {
        overlaps: true;
        reason: string;
    };
}
export declare function stMatches(a: Stats | null, b: Stats | null): {
    matches: true;
} | {
    matches: false;
    reason: string;
};
export declare function consistentPathSort(a: Dirent, b: Dirent): number;
//# sourceMappingURL=fs.d.ts.map