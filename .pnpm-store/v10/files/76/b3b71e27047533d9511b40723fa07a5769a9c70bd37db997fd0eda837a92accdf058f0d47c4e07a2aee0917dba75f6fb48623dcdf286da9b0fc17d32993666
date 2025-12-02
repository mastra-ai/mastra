// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Stats extends APIResource {
    /**
     * Fetch usage statistics details for Cloudflare Images.
     *
     * @example
     * ```ts
     * const stat = await client.images.v1.stats.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/stats`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=stats.mjs.map