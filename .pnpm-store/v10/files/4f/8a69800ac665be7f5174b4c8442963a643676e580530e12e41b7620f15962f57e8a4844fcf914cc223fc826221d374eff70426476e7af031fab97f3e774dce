import type { Credentials, RepoDesignation } from "../types/public";
export interface CommitData {
    oid: string;
    title: string;
    message: string;
    authors: Array<{
        username: string;
        avatarUrl: string;
    }>;
    date: Date;
}
export declare function listCommits(params: {
    credentials?: Credentials;
    repo: RepoDesignation;
    /**
     * Revision to list commits from. Defaults to the default branch.
     */
    revision?: string;
    hubUrl?: string;
    /**
     * Number of commits to fetch from the hub each http call. Defaults to 100. Can be set to 1000.
     */
    batchSize?: number;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): AsyncGenerator<CommitData>;
//# sourceMappingURL=list-commits.d.ts.map