import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Assets extends APIResource {
    /**
     * Upload a Finetune Asset
     */
    create(finetuneId: string, params: AssetCreateParams, options?: Core.RequestOptions): Core.APIPromise<AssetCreateResponse>;
}
export interface AssetCreateResponse {
    id: string;
    bucket_name: string;
    created_at: string;
    file_name: string;
    finetune_id: string;
    modified_at: string;
}
export interface AssetCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    file?: Core.Uploadable;
    /**
     * Body param:
     */
    file_name?: string;
}
export declare namespace Assets {
    export { type AssetCreateResponse as AssetCreateResponse, type AssetCreateParams as AssetCreateParams };
}
//# sourceMappingURL=assets.d.ts.map