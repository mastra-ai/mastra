import type { Credentials, RepoDesignation } from "../types/public";
/**
 * @returns null when the file doesn't exist
 */
export declare function downloadFile(params: {
    repo: RepoDesignation;
    path: string;
    /**
     * If true, will download the raw git file.
     *
     * For example, when calling on a file stored with Git LFS, the pointer file will be downloaded instead.
     */
    raw?: boolean;
    /**
     * An optional Git revision id which can be a branch name, a tag, or a commit hash.
     *
     * @default "main"
     */
    revision?: string;
    /**
     * Fetch only a specific part of the file
     */
    range?: [number, number];
    credentials?: Credentials;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): Promise<Response | null>;
//# sourceMappingURL=download-file.d.ts.map