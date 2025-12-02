import type { Credentials, RepoDesignation, SpaceSdk } from "../types/public";
export declare function createRepo(params: {
    repo: RepoDesignation;
    credentials: Credentials;
    private?: boolean;
    license?: string;
    /**
     * Only a few lightweight files are supported at repo creation
     */
    files?: Array<{
        content: ArrayBuffer | Blob;
        path: string;
    }>;
    /** @required for when {@link repo.type} === "space" */
    sdk?: SpaceSdk;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}): Promise<{
    repoUrl: string;
}>;
//# sourceMappingURL=create-repo.d.ts.map