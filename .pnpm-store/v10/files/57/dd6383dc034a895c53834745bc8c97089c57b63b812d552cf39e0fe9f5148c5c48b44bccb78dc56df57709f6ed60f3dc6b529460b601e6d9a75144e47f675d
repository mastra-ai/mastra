// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Previews extends APIResource {
    /**
     * Get the result of a previous preview operation using the provided preview_id.
     *
     * @example
     * ```ts
     * const preview = await client.loadBalancers.previews.get(
     *   'p1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(previewId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/preview/${previewId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=previews.mjs.map