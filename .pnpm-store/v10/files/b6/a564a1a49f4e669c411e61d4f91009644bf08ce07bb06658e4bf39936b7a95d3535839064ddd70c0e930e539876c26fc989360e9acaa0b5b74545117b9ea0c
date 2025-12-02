import type { CommitOutput, CommitParams, CommitProgressEvent, ContentSource } from "./commit";
/**
 * Uploads with progress
 *
 * Needs XMLHttpRequest to be available for progress events for uploads
 * Set useWebWorkers to true in order to have progress events for hashing
 */
export declare function uploadFilesWithProgress(params: {
    credentials?: CommitParams["credentials"];
    repo: CommitParams["repo"];
    files: Array<URL | File | {
        path: string;
        content: ContentSource;
    }>;
    commitTitle?: CommitParams["title"];
    commitDescription?: CommitParams["description"];
    hubUrl?: CommitParams["hubUrl"];
    branch?: CommitParams["branch"];
    isPullRequest?: CommitParams["isPullRequest"];
    parentCommit?: CommitParams["parentCommit"];
    abortSignal?: CommitParams["abortSignal"];
    /**
     * Set this to true in order to have progress events for hashing
     */
    useWebWorkers?: CommitParams["useWebWorkers"];
}): AsyncGenerator<CommitProgressEvent, CommitOutput>;
//# sourceMappingURL=upload-files-with-progress.d.ts.map