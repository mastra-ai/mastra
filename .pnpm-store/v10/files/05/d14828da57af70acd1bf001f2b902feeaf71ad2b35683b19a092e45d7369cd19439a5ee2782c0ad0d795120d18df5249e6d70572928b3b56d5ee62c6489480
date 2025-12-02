import type { ApiSpaceInfo } from "../types/api/api-space";
import type { Credentials, SpaceSdk } from "../types/public";
declare const EXPAND_KEYS: readonly ["sdk", "likes", "private", "lastModified"];
declare const EXPANDABLE_KEYS: readonly ["author", "cardData", "datasets", "disabled", "gitalyUid", "lastModified", "createdAt", "likes", "private", "runtime", "sdk", "sha", "subdomain", "tags", "models"];
export interface SpaceEntry {
    id: string;
    name: string;
    sdk?: SpaceSdk;
    likes: number;
    private: boolean;
    updatedAt: Date;
}
export declare function listSpaces<const T extends Exclude<(typeof EXPANDABLE_KEYS)[number], (typeof EXPAND_KEYS)[number]> = never>(params?: {
    search?: {
        /**
         * Will search in the space name for matches
         */
        query?: string;
        owner?: string;
        tags?: string[];
    };
    credentials?: Credentials;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    /**
     * Additional fields to fetch from huggingface.co.
     */
    additionalFields?: T[];
}): AsyncGenerator<SpaceEntry & Pick<ApiSpaceInfo, T>>;
export {};
//# sourceMappingURL=list-spaces.d.ts.map