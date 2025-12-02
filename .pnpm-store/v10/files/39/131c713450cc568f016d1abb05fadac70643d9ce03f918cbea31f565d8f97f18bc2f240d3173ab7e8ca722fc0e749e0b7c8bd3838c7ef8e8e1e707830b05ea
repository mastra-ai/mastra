// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ViewsAPI from "./views.mjs";
import { ViewListResponsesV4PagePaginationArray, Views, } from "./views.mjs";
export class Account extends APIResource {
    constructor() {
        super(...arguments);
        this.views = new ViewsAPI.Views(this._client);
    }
    /**
     * Update DNS settings for an account
     *
     * @example
     * ```ts
     * const response = await client.dns.settings.account.edit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dns_settings`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show DNS settings for an account
     *
     * @example
     * ```ts
     * const account = await client.dns.settings.account.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dns_settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
Account.Views = Views;
Account.ViewListResponsesV4PagePaginationArray = ViewListResponsesV4PagePaginationArray;
//# sourceMappingURL=account.mjs.map