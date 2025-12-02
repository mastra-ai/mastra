import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as AssetsAPI from "./assets.js";
import { AssetCreateParams, AssetCreateResponse, Assets } from "./assets.js";
import * as PublicAPI from "./public.js";
import { Public, PublicListParams, PublicListResponse, PublicListResponsesSinglePage } from "./public.js";
export declare class Finetunes extends APIResource {
    assets: AssetsAPI.Assets;
    public: PublicAPI.Public;
    /**
     * Create a new Finetune
     */
    create(params: FinetuneCreateParams, options?: Core.RequestOptions): Core.APIPromise<FinetuneCreateResponse>;
    /**
     * List Finetunes
     */
    list(params: FinetuneListParams, options?: Core.RequestOptions): Core.APIPromise<FinetuneListResponse>;
}
export interface FinetuneCreateResponse {
    id: string;
    created_at: string;
    model: string;
    modified_at: string;
    name: string;
    public: boolean;
    description?: string;
}
export interface FinetuneListResponse {
    id: string;
    created_at: string;
    model: string;
    modified_at: string;
    name: string;
    description?: string;
}
export interface FinetuneCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    model: string;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param:
     */
    description?: string;
    /**
     * Body param:
     */
    public?: boolean;
}
export interface FinetuneListParams {
    account_id: string;
}
export declare namespace Finetunes {
    export { type FinetuneCreateResponse as FinetuneCreateResponse, type FinetuneListResponse as FinetuneListResponse, type FinetuneCreateParams as FinetuneCreateParams, type FinetuneListParams as FinetuneListParams, };
    export { Assets as Assets, type AssetCreateResponse as AssetCreateResponse, type AssetCreateParams as AssetCreateParams, };
    export { Public as Public, type PublicListResponse as PublicListResponse, PublicListResponsesSinglePage as PublicListResponsesSinglePage, type PublicListParams as PublicListParams, };
}
//# sourceMappingURL=finetunes.d.ts.map