import type { Credentials, RepoDesignation } from "../types/public";
export interface ListFileEntry {
    type: "file" | "directory" | "unknown";
    size: number;
    path: string;
    oid: string;
    lfs?: {
        oid: string;
        size: number;
        /** Size of the raw pointer file, 100~200 bytes */
        pointerSize: number;
    };
    /**
     * Only fetched if `expand` is set to `true` in the `listFiles` call.
     */
    lastCommit?: {
        date: string;
        id: string;
        title: string;
    };
    /**
     * Only fetched if `expand` is set to `true` in the `listFiles` call.
     */
    security?: unknown;
}
/**
 * List files in a folder. To list ALL files in the directory, call it
 * with {@link params.recursive} set to `true`.
 */
export declare function listFiles(params: {
    repo: RepoDesignation;
    /**
     * Do we want to list files in subdirectories?
     */
    recursive?: boolean;
    /**
     * Eg 'data' for listing all files in the 'data' folder. Leave it empty to list all
     * files in the repo.
     */
    path?: string;
    /**
     * Fetch `lastCommit` and `securityStatus` for each file.
     */
    expand?: boolean;
    revision?: string;
    credentials?: Credentials;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): AsyncGenerator<ListFileEntry>;
//# sourceMappingURL=list-files.d.ts.map