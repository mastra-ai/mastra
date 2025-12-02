// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Views extends APIResource {
    /**
     * Create Internal DNS View for an account
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.create(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'my view',
     *     zones: ['372e67954025e0ba6aaa6d586b9e0b59'],
     *   },
     * );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dns_settings/views`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List DNS Internal Views for an Account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const viewListResponse of client.dns.settings.account.views.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dns_settings/views`, ViewListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete an existing Internal DNS View
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(viewId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dns_settings/views/${viewId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing Internal DNS View
     *
     * @example
     * ```ts
     * const response =
     *   await client.dns.settings.account.views.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(viewId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dns_settings/views/${viewId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get DNS Internal View
     *
     * @example
     * ```ts
     * const view = await client.dns.settings.account.views.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(viewId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dns_settings/views/${viewId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ViewListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Views.ViewListResponsesV4PagePaginationArray = ViewListResponsesV4PagePaginationArray;
//# sourceMappingURL=views.mjs.map