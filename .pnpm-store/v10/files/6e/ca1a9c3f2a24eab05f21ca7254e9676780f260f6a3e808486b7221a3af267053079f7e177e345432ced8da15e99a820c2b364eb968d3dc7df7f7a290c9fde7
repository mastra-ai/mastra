import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiIndexTreeEntry } from "../types/api/api-index-tree";
import type { Credentials, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { toRepoId } from "../utils/toRepoId";

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
export async function* listFiles(params: {
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
}): AsyncGenerator<ListFileEntry> {
	checkCredentials(params.credentials);
	const repoId = toRepoId(params.repo);
	let url: string | undefined = `${params.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}/tree/${
		params.revision || "main"
	}${params.path ? "/" + params.path : ""}?recursive=${!!params.recursive}&expand=${!!params.expand}`;

	while (url) {
		const res: Response = await (params.fetch ?? fetch)(url, {
			headers: {
				accept: "application/json",
				...(params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : undefined),
			},
		});

		if (!res.ok) {
			throw await createApiError(res);
		}

		const items: ApiIndexTreeEntry[] = await res.json();

		for (const item of items) {
			yield item;
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
	}
}
