import type { ApiModelInfo } from "../types/api/api-model";
import type { Credentials, PipelineType } from "../types/public";
declare const EXPAND_KEYS: readonly ["pipeline_tag", "private", "gated", "downloads", "likes", "lastModified"];
declare const EXPANDABLE_KEYS: readonly ["author", "cardData", "config", "createdAt", "disabled", "downloads", "downloadsAllTime", "gated", "gitalyUid", "lastModified", "library_name", "likes", "model-index", "pipeline_tag", "private", "safetensors", "sha", "spaces", "tags", "transformersInfo"];
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
export declare function listModels<const T extends Exclude<(typeof EXPANDABLE_KEYS)[number], (typeof EXPAND_KEYS)[number]> = never>(params?: {
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
}): AsyncGenerator<ModelEntry & Pick<ApiModelInfo, T>>;
export {};
//# sourceMappingURL=list-models.d.ts.map