import type { License, SpaceRuntime, SpaceSdk } from "../public";
type Color = "red" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink" | "gray";
export interface ApiSpaceInfo {
    _id: string;
    id: string;
    arxivIds?: string[];
    author: string;
    cardExists?: true;
    cardError?: unknown;
    cardData?: unknown;
    contributors?: Array<{
        user: string;
        _id: string;
    }>;
    disabled: boolean;
    discussionsDisabled: boolean;
    duplicationDisabled: boolean;
    gated: false | "auto" | "manual";
    gitalyUid: string;
    lastAuthor: {
        email: string;
        user?: string;
    };
    lastModified: string;
    likes: number;
    likesRecent: number;
    private: boolean;
    updatedAt: string;
    createdAt: string;
    tags: string[];
    sha: string;
    subdomain: string;
    title: string;
    emoji: string;
    colorFrom: Color;
    colorTo: Color;
    pinned: boolean;
    siblings: Array<{
        rfilename: string;
    }>;
    sdk?: SpaceSdk;
    runtime?: SpaceRuntime;
    models?: string[];
    datasets?: string[];
    originSpace?: {
        _id: string;
        authorId: string;
    };
}
export interface ApiSpaceMetadata {
    license?: License | License[];
    tags?: string[];
    title?: string;
    colorFrom?: "red" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink" | "gray";
    colorTo?: "red" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink" | "gray";
    emoji?: string;
    sdk?: "streamlit" | "gradio" | "docker" | "static";
    sdk_version?: string | string;
    python_version?: string | string;
    fullWidth?: boolean;
    header?: "mini" | "default";
    app_file?: string;
    app_port?: number;
    base_path?: string;
    models?: string[];
    datasets?: string[];
    pinned?: boolean;
    metaTitle?: string;
    description?: string;
    thumbnail?: string;
    /**
     * If enabled, will associate an oauth app to the Space, adding variables and secrets to the Space's environment
     */
    hf_oauth?: boolean;
    /**
     * The expiration of access tokens for your oauth app in minutes. max 30 days (43,200 minutes). Defaults to 8 hours (480 minutes)
     */
    hf_oauth_expiration_minutes?: number;
    /**
     * OAuth scopes to request. By default you have access to the user's profile, you can request access to their repos or inference-api.
     */
    hf_oauth_scopes?: ("email" | "read-repos" | "write-repos" | "manage-repos" | "inference-api")[];
    suggested_hardware?: "cpu-basic" | "zero-a10g" | "cpu-upgrade" | "cpu-xl" | "t4-small" | "t4-medium" | "a10g-small" | "a10g-large" | "a10g-largex2" | "a10g-largex4" | "a100-large";
    suggested_storage?: "small" | "medium" | "large";
    custom_headers?: {
        "cross-origin-embedder-policy"?: "unsafe-none" | "require-corp" | "credentialless";
        "cross-origin-opener-policy"?: "same-origin" | "same-origin-allow-popups" | "unsafe-none";
        "cross-origin-resource-policy"?: "same-site" | "same-origin" | "cross-origin";
    };
}
export {};
//# sourceMappingURL=api-space.d.ts.map