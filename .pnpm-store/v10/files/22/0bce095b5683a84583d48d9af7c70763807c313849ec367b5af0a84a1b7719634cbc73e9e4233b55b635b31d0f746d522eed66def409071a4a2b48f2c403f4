import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Public extends APIResource {
    /**
     * List Public Finetunes
     */
    list(params: PublicListParams, options?: Core.RequestOptions): Core.PagePromise<PublicListResponsesSinglePage, PublicListResponse>;
}
export declare class PublicListResponsesSinglePage extends SinglePage<PublicListResponse> {
}
export interface PublicListResponse {
    id: string;
    created_at: string;
    model: string;
    modified_at: string;
    name: string;
    public: boolean;
    description?: string;
}
export interface PublicListParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: Pagination Limit
     */
    limit?: number;
    /**
     * Query param: Pagination Offset
     */
    offset?: number;
    /**
     * Query param: Order By Column Name
     */
    orderBy?: string;
}
export declare namespace Public {
    export { type PublicListResponse as PublicListResponse, PublicListResponsesSinglePage as PublicListResponsesSinglePage, type PublicListParams as PublicListParams, };
}
//# sourceMappingURL=public.d.ts.map