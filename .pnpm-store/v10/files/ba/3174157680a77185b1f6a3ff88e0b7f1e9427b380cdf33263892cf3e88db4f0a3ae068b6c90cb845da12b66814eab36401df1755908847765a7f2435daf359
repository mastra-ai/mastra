"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomNameserverUpdateResponsesSinglePage = exports.CustomNameservers = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
/**
 * @deprecated Use DNS settings API instead.
 */
class CustomNameservers extends resource_1.APIResource {
    /**
     * Set metadata for account-level custom nameservers on a zone.
     *
     * If you would like new zones in the account to use account custom nameservers by
     * default, use PUT /accounts/:identifier to set the account setting
     * use_account_custom_ns_by_default to true.
     *
     * Deprecated in favor of
     * [Update DNS Settings](https://developers.cloudflare.com/api/operations/dns-settings-for-a-zone-update-dns-settings).
     *
     * @deprecated Use [DNS settings API](https://developers.cloudflare.com/api/resources/dns/subresources/settings/methods/put/) instead.
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/custom_ns`, CustomNameserverUpdateResponsesSinglePage, {
            body,
            method: 'put',
            ...options,
        });
    }
    /**
     * Get metadata for account-level custom nameservers on a zone.
     *
     * Deprecated in favor of
     * [Show DNS Settings](https://developers.cloudflare.com/api/operations/dns-settings-for-a-zone-list-dns-settings).
     *
     * @deprecated Use [DNS settings API](https://developers.cloudflare.com/api/resources/dns/subresources/settings/methods/get/) instead.
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/custom_ns`, options);
    }
}
exports.CustomNameservers = CustomNameservers;
class CustomNameserverUpdateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CustomNameserverUpdateResponsesSinglePage = CustomNameserverUpdateResponsesSinglePage;
CustomNameservers.CustomNameserverUpdateResponsesSinglePage = CustomNameserverUpdateResponsesSinglePage;
//# sourceMappingURL=custom-nameservers.js.map