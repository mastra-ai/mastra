import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class References extends APIResource {
    /**
     * Get the list of resources that reference the provided pool.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const referenceGetResponse of client.loadBalancers.pools.references.get(
     *   '17b5962d775c646f3f9725cbc7a53df4',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(poolId: string, params: ReferenceGetParams, options?: Core.RequestOptions): Core.PagePromise<ReferenceGetResponsesSinglePage, ReferenceGetResponse>;
}
export declare class ReferenceGetResponsesSinglePage extends SinglePage<ReferenceGetResponse> {
}
export interface ReferenceGetResponse {
    reference_type?: '*' | 'referral' | 'referrer';
    resource_id?: string;
    resource_name?: string;
    resource_type?: string;
}
export interface ReferenceGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace References {
    export { type ReferenceGetResponse as ReferenceGetResponse, ReferenceGetResponsesSinglePage as ReferenceGetResponsesSinglePage, type ReferenceGetParams as ReferenceGetParams, };
}
//# sourceMappingURL=references.d.ts.map