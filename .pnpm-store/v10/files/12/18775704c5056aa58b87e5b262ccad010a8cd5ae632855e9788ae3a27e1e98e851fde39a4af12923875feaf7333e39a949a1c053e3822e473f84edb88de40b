// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class WANs extends APIResource {
    /**
     * Creates a new Site WAN.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const wan of client.magicTransit.sites.wans.create(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     physport: 1,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/wans`, WANsSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
    /**
     * Update a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId, wanId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/sites/${siteId}/wans/${wanId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Site WANs associated with an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const wan of client.magicTransit.sites.wans.list(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(siteId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites/${siteId}/wans`, WANsSinglePage, options);
    }
    /**
     * Remove a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId, wanId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/sites/${siteId}/wans/${wanId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(siteId, wanId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}/wans/${wanId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific Site WAN.
     *
     * @example
     * ```ts
     * const wan = await client.magicTransit.sites.wans.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId, wanId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/sites/${siteId}/wans/${wanId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WANsSinglePage extends SinglePage {
}
WANs.WANsSinglePage = WANsSinglePage;
//# sourceMappingURL=wans.mjs.map