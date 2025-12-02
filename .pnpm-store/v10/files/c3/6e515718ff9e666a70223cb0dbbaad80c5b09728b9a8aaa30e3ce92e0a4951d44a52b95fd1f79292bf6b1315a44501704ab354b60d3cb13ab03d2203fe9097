// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class References extends APIResource {
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
    get(poolId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/pools/${poolId}/references`, ReferenceGetResponsesSinglePage, options);
    }
}
export class ReferenceGetResponsesSinglePage extends SinglePage {
}
References.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;
//# sourceMappingURL=references.mjs.map