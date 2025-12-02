// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Previews extends APIResource {
    /**
     * Preview pools using the specified monitor with provided monitor details. The
     * returned preview_id can be used in the preview endpoint to retrieve the results.
     *
     * @example
     * ```ts
     * const preview =
     *   await client.loadBalancers.monitors.previews.create(
     *     'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(monitorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/load_balancers/monitors/${monitorId}/preview`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=previews.mjs.map