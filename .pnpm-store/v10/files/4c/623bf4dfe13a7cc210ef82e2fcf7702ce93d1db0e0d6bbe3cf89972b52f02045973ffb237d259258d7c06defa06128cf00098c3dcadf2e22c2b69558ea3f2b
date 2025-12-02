import type { Credentials, RepoDesignation } from "../types/public";
export interface CommitDeletedEntry {
    operation: "delete";
    path: string;
}
export type ContentSource = Blob | URL;
export interface CommitFile {
    operation: "addOrUpdate";
    path: string;
    content: ContentSource;
}
export type CommitOperation = CommitDeletedEntry | CommitFile;
export interface CommitParams {
    title: string;
    description?: string;
    repo: RepoDesignation;
    operations: CommitOperation[];
    credentials?: Credentials;
    /** @default "main" */
    branch?: string;
    /**
     * Parent commit. Optional
     *
     * - When opening a PR: will use parentCommit as the parent commit
     * - When committing on a branch: Will make sure that there were no intermediate commits
     */
    parentCommit?: string;
    isPullRequest?: boolean;
    hubUrl?: string;
    /**
     * Whether to use web workers to compute SHA256 hashes.
     *
     * We load hash-wasm from a CDN inside the web worker. Not sure how to do otherwise and still have a "clean" bundle.
     */
    useWebWorkers?: boolean | {
        minSize?: number;
        poolSize?: number;
    };
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    abortSignal?: AbortSignal;
}
export interface CommitOutput {
    pullRequestUrl?: string;
    commit: {
        oid: string;
        url: string;
    };
    hookOutput: string;
}
export type CommitProgressEvent = {
    event: "phase";
    phase: "preuploading" | "uploadingLargeFiles" | "committing";
} | {
    event: "fileProgress";
    path: string;
    progress: number;
    state: "hashing" | "uploading";
};
/**
 * Internal function for now, used by commit.
 *
 * Can be exposed later to offer fine-tuned progress info
 */
export declare function commitIter(params: CommitParams): AsyncGenerator<CommitProgressEvent, CommitOutput>;
export declare function commit(params: CommitParams): Promise<CommitOutput>;
//# sourceMappingURL=commit.d.ts.map