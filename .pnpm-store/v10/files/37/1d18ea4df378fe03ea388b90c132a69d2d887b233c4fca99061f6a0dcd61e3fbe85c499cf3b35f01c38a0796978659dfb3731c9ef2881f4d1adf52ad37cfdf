import type { Credentials } from "../types/public";
import type { CommitOutput, CommitParams } from "./commit";
import { commit } from "./commit";

export function deleteFiles(params: {
	credentials: Credentials;
	repo: CommitParams["repo"];
	paths: string[];
	commitTitle?: CommitParams["title"];
	commitDescription?: CommitParams["description"];
	hubUrl?: CommitParams["hubUrl"];
	branch?: CommitParams["branch"];
	isPullRequest?: CommitParams["isPullRequest"];
	parentCommit?: CommitParams["parentCommit"];
	fetch?: CommitParams["fetch"];
}): Promise<CommitOutput> {
	return commit({
		credentials: params.credentials,
		repo: params.repo,
		operations: params.paths.map((path) => ({
			operation: "delete",
			path,
		})),
		title: params.commitTitle ?? `Deletes ${params.paths.length} files`,
		description: params.commitDescription,
		hubUrl: params.hubUrl,
		branch: params.branch,
		isPullRequest: params.isPullRequest,
		parentCommit: params.parentCommit,
		fetch: params.fetch,
	});
}
