// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class CatchAlls extends APIResource {
    /**
     * Enable or disable catch-all routing rule, or change action to forward to
     * specific destination address.
     *
     * @example
     * ```ts
     * const catchAll =
     *   await client.emailRouting.rules.catchAlls.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     actions: [{ type: 'forward' }],
     *     matchers: [{ type: 'all' }],
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/email/routing/rules/catch_all`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information on the default catch-all routing rule.
     *
     * @example
     * ```ts
     * const catchAll =
     *   await client.emailRouting.rules.catchAlls.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/email/routing/rules/catch_all`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=catch-alls.mjs.map