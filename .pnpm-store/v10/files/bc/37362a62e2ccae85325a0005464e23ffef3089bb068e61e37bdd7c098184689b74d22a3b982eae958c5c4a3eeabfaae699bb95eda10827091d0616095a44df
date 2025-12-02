import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { ApiModelInfo } from "../types/api/api-model";
import type { Credentials, PipelineType } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { pick } from "../utils/pick";

const EXPAND_KEYS = [
	"pipeline_tag",
	"private",
	"gated",
	"downloads",
	"likes",
	"lastModified",
] as const satisfies readonly (keyof ApiModelInfo)[];

const EXPANDABLE_KEYS = [
	"author",
	"cardData",
	"config",
	"createdAt",
	"disabled",
	"downloads",
	"downloadsAllTime",
	"gated",
	"gitalyUid",
	"lastModified",
	"library_name",
	"likes",
	"model-index",
	"pipeline_tag",
	"private",
	"safetensors",
	"sha",
	// "siblings",
	"spaces",
	"tags",
	"transformersInfo",
] as const satisfies readonly (keyof ApiModelInfo)[];

export interface ModelEntry {
	id: string;
	name: string;
	private: boolean;
	gated: false | "auto" | "manual";
	task?: PipelineType;
	likes: number;
	downloads: number;
	updatedAt: Date;
}

export async function* listModels<
	const T extends Exclude<(typeof EXPANDABLE_KEYS)[number], (typeof EXPAND_KEYS)[number]> = never,
>(params?: {
	search?: {
		/**
		 * Will search in the model name for matches
		 */
		query?: string;
		owner?: string;
		task?: PipelineType;
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
}): AsyncGenerator<ModelEntry & Pick<ApiModelInfo, T>> {
	checkCredentials(params?.credentials);
	let totalToFetch = params?.limit ?? Infinity;
	const search = new URLSearchParams([
		...Object.entries({
			limit: String(Math.min(totalToFetch, 500)),
			...(params?.search?.owner ? { author: params.search.owner } : undefined),
			...(params?.search?.task ? { pipeline_tag: params.search.task } : undefined),
			...(params?.search?.query ? { search: params.search.query } : undefined),
		}),
		...(params?.search?.tags?.map((tag) => ["filter", tag]) ?? []),
		...EXPAND_KEYS.map((val) => ["expand", val] satisfies [string, string]),
		...(params?.additionalFields?.map((val) => ["expand", val] satisfies [string, string]) ?? []),
	]).toString();
	let url: string | undefined = `${params?.hubUrl || HUB_URL}/api/models?${search}`;

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

		const items: ApiModelInfo[] = await res.json();

		for (const item of items) {
			yield {
				...(params?.additionalFields && pick(item, params.additionalFields)),
				id: item._id,
				name: item.id,
				private: item.private,
				task: item.pipeline_tag,
				downloads: item.downloads,
				gated: item.gated,
				likes: item.likes,
				updatedAt: new Date(item.lastModified),
			} as ModelEntry & Pick<ApiModelInfo, T>;
			totalToFetch--;

			if (totalToFetch <= 0) {
				return;
			}
		}

		const linkHeader = res.headers.get("Link");

		url = linkHeader ? parseLinkHeader(linkHeader).next : undefined;
		// Could update url to reduce the limit if we don't need the whole 500 of the next batch.
	}
}
