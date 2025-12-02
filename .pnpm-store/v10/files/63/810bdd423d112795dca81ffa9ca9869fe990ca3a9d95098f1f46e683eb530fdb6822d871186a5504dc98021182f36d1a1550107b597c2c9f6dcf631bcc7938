"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustedDomainListResponsesV4PagePaginationArray = exports.TrustedDomains = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class TrustedDomains extends resource_1.APIResource {
    /**
     * Create a trusted email domain
     *
     * @example
     * ```ts
     * const trustedDomain =
     *   await client.emailSecurity.settings.trustedDomains.create(
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       is_recent: true,
     *       is_regex: false,
     *       is_similarity: false,
     *       pattern: 'example.com',
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/settings/trusted_domains`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists, searches, and sorts an account’s trusted email domains.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const trustedDomainListResponse of client.emailSecurity.settings.trustedDomains.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/trusted_domains`, TrustedDomainListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a trusted email domain
     *
     * @example
     * ```ts
     * const trustedDomain =
     *   await client.emailSecurity.settings.trustedDomains.delete(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(trustedDomainId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a trusted email domain
     *
     * @example
     * ```ts
     * const response =
     *   await client.emailSecurity.settings.trustedDomains.edit(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(trustedDomainId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a trusted email domain
     *
     * @example
     * ```ts
     * const trustedDomain =
     *   await client.emailSecurity.settings.trustedDomains.get(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(trustedDomainId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/settings/trusted_domains/${trustedDomainId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.TrustedDomains = TrustedDomains;
class TrustedDomainListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.TrustedDomainListResponsesV4PagePaginationArray = TrustedDomainListResponsesV4PagePaginationArray;
TrustedDomains.TrustedDomainListResponsesV4PagePaginationArray =
    TrustedDomainListResponsesV4PagePaginationArray;
//# sourceMappingURL=trusted-domains.js.map