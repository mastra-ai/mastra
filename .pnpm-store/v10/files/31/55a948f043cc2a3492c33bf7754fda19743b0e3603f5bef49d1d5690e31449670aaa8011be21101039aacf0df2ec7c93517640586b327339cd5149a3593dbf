import type { Credentials } from "../types/public";
import type { CommitOutput, CommitParams, ContentSource } from "./commit";
export declare function uploadFile(params: {
    credentials?: Credentials;
    repo: CommitParams["repo"];
    file: URL | File | {
        path: string;
        content: ContentSource;
    };
    commitTitle?: CommitParams["title"];
    commitDescription?: CommitParams["description"];
    hubUrl?: CommitParams["hubUrl"];
    branch?: CommitParams["branch"];
    isPullRequest?: CommitParams["isPullRequest"];
    parentCommit?: CommitParams["parentCommit"];
    fetch?: CommitParams["fetch"];
    useWebWorkers?: CommitParams["useWebWorkers"];
    abortSignal?: CommitParams["abortSignal"];
}): Promise<CommitOutput>;
//# sourceMappingURL=upload-file.d.ts.map