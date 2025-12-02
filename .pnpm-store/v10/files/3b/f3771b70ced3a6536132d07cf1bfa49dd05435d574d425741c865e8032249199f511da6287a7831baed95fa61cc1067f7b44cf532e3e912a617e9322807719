import type { Credentials } from "../types/public";
import type { CommitOutput, CommitParams, ContentSource } from "./commit";
import { commit } from "./commit";

export function uploadFile(params: {
	credentials?: Credentials;
	repo: CommitParams["repo"];
	file: URL | File | { path: string; content: ContentSource };
	commitTitle?: CommitParams["title"];
	commitDescription?: CommitParams["description"];
	hubUrl?: CommitParams["hubUrl"];
	branch?: CommitParams["branch"];
	isPullRequest?: CommitParams["isPullRequest"];
	parentCommit?: CommitParams["parentCommit"];
	fetch?: CommitParams["fetch"];
	useWebWorkers?: CommitParams["useWebWorkers"];
	abortSignal?: CommitParams["abortSignal"];
}): Promise<CommitOutput> {
	const path =
		params.file instanceof URL
			? params.file.pathname.split("/").at(-1) ?? "file"
			: "path" in params.file
			  ? params.file.path
			  : params.file.name;

	return commit({
		credentials: params.credentials,
		repo: params.repo,
		operations: [
			{
				operation: "addOrUpdate",
				path,
				content: "content" in params.file ? params.file.content : params.file,
			},
		],
		title: params.commitTitle ?? `Add ${path}`,
		description: params.commitDescription,
		hubUrl: params.hubUrl,
		branch: params.branch,
		isPullRequest: params.isPullRequest,
		parentCommit: params.parentCommit,
		fetch: params.fetch,
		useWebWorkers: params.useWebWorkers,
		abortSignal: params.abortSignal,
	});
}
