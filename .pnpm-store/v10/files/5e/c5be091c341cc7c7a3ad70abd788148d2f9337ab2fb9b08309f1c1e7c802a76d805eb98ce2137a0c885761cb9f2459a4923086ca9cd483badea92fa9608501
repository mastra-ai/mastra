import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiCommitData } from "../types/api/api-commit";
import type { Credentials, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { toRepoId } from "../utils/toRepoId";

export interface CommitData {
	oid: string;
	title: string;
	message: string;
	authors: Array<{ username: string; avatarUrl: string }>;
	date: Date;
}

export async function* listCommits(params: {
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
}): AsyncGenerator<CommitData> {
	checkCredentials(params.credentials);
	const repoId = toRepoId(params.repo);

	// Could upgrade to 1000 commits per page
	let url: string | undefined = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${
		params.revision ?? "main"
	}?limit=${params.batchSize ?? 100}`;

	while (url) {
		const res: Response = await (params.fetch ?? fetch)(url, {
			headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {},
		});

		if (!res.ok) {
			throw await createApiError(res);
		}

		const resJson: ApiCommitData[] = await res.json();
		for (const commit of resJson) {
			yield {
				oid: commit.id,
				title: commit.title,
				message: commit.message,
				authors: commit.authors.map((author) => ({
					username: author.user,
					avatarUrl: author.avatar,
				})),
				date: new Date(commit.date),
			};
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
	}
}
