import { Package } from "@manypkg/get-packages";
export declare function add(pathToFile: string, cwd: string): Promise<boolean>;
export declare function commit(message: string, cwd: string): Promise<boolean>;
export declare function getAllTags(cwd: string): Promise<Set<string>>;
export declare function tag(tagStr: string, cwd: string): Promise<boolean>;
export declare function getDivergedCommit(cwd: string, ref: string): Promise<string>;
/**
 * Get the SHAs for the commits that added files, including automatically
 * extending a shallow clone if necessary to determine any commits.
 * @param gitPaths - Paths to fetch
 * @param options - `cwd` and `short`
 */
export declare function getCommitsThatAddFiles(gitPaths: string[], { cwd, short }: {
    cwd: string;
    short?: boolean;
}): Promise<(string | undefined)[]>;
export declare function isRepoShallow({ cwd }: {
    cwd: string;
}): Promise<boolean>;
export declare function deepenCloneBy({ by, cwd }: {
    by: number;
    cwd: string;
}): Promise<void>;
export declare function getChangedFilesSince({ cwd, ref, fullPath, }: {
    cwd: string;
    ref: string;
    fullPath?: boolean;
}): Promise<Array<string>>;
export declare function getChangedChangesetFilesSinceRef({ cwd, ref, }: {
    cwd: string;
    ref: string;
}): Promise<Array<string>>;
export declare function getChangedPackagesSinceRef({ cwd, ref, changedFilePatterns, }: {
    cwd: string;
    ref: string;
    changedFilePatterns?: readonly string[];
}): Promise<Package[]>;
export declare function tagExists(tagStr: string, cwd: string): Promise<boolean>;
export declare function getCurrentCommitId({ cwd, short, }: {
    cwd: string;
    short?: boolean;
}): Promise<string>;
export declare function remoteTagExists(tagStr: string): Promise<boolean>;
