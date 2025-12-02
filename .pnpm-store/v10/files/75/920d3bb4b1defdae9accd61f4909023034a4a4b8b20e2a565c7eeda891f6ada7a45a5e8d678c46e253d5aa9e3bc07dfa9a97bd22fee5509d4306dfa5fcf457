import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiDatasetInfo } from "../types/api/api-dataset";
import type { Credentials } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { pick } from "../utils/pick";

const EXPAND_KEYS = [
	"private",
	"downloads",
	"gated",
	"likes",
	"lastModified",
] as const satisfies readonly (keyof ApiDatasetInfo)[];

const EXPANDABLE_KEYS = [
	"author",
	"cardData",
	"citation",
	"createdAt",
	"disabled",
	"description",
	"downloads",
	"downloadsAllTime",
	"gated",
	"gitalyUid",
	"lastModified",
	"likes",
	"paperswithcode_id",
	"private",
	// "siblings",
	"sha",
	"tags",
] as const satisfies readonly (keyof ApiDatasetInfo)[];

export interface DatasetEntry {
	id: string;
	name: string;
	private: boolean;
	downloads: number;
	gated: false | "auto" | "manual";
	likes: number;
	updatedAt: Date;
}

export async function* listDatasets<
	const T extends Exclude<(typeof EXPANDABLE_KEYS)[number], (typeof EXPAND_KEYS)[number]> = never,
>(params?: {
	search?: {
		/**
		 * Will search in the dataset name for matches
		 */
		query?: string;
		owner?: string;
		tags?: string[];
	};
	credentials?: Credentials;
	hubUrl?: string;
	additionalFields?: T[];
	/**
	 * Set to limit the number of models returned.
	 */
	limit?: number;
	/**
	 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
	 */
	fetch?: typeof fetch;
}): AsyncGenerator<DatasetEntry & Pick<ApiDatasetInfo, T>> {
	checkCredentials(params?.credentials);
	let totalToFetch = params?.limit ?? Infinity;
	const search = new URLSearchParams([
		...Object.entries({
			limit: String(Math.min(totalToFetch, 500)),
			...(params?.search?.owner ? { author: params.search.owner } : undefined),
			...(params?.search?.query ? { search: params.search.query } : undefined),
		}),
		...(params?.search?.tags?.map((tag) => ["filter", tag]) ?? []),
		...EXPAND_KEYS.map((val) => ["expand", val] satisfies [string, string]),
		...(params?.additionalFields?.map((val) => ["expand", val] satisfies [string, string]) ?? []),
	]).toString();
	let url: string | undefined = `${params?.hubUrl || HUB_URL}/api/datasets` + (search ? "?" + search : "");

	while (url) {
		const res: Response = await (params?.fetch ?? fetch)(url, {
			headers: {
				accept: "application/json",
				...(params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : undefined),
			},
		});

		if (!res.ok) {
			throw await createApiError(res);
		}

		const items: ApiDatasetInfo[] = await res.json();

		for (const item of items) {
			yield {
				...(params?.additionalFields && pick(item, params.additionalFields)),
				id: item._id,
				name: item.id,
				private: item.private,
				downloads: item.downloads,
				likes: item.likes,
				gated: item.gated,
				updatedAt: new Date(item.lastModified),
			} as DatasetEntry & Pick<ApiDatasetInfo, T>;
			totalToFetch--;
			if (totalToFetch <= 0) {
				return;
			}
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
		// Could update limit in url to fetch less items if not all items of next page are needed.
	}
}
