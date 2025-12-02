// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage, V4PagePaginationArray } from "../../../pagination.mjs";
export class Domains extends APIResource {
    /**
     * Lists, searches, and sorts an account’s email domains.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domainListResponse of client.emailSecurity.settings.domains.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/domains`, DomainListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Unprotect an email domain
     *
     * @example
     * ```ts
     * const domain =
     *   await client.emailSecurity.settings.domains.delete(2400, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(domainId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email-security/settings/domains/${domainId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Unprotect multiple email domains
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domainBulkDeleteResponse of client.emailSecurity.settings.domains.bulkDelete(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkDelete(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/domains`, DomainBulkDeleteResponsesSinglePage, { method: 'delete', ...options });
    }
    /**
     * Update an email domain
     *
     * @example
     * ```ts
     * const response =
     *   await client.emailSecurity.settings.domains.edit(2400, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     ip_restrictions: ['192.0.2.0/24', '2001:db8::/32'],
     *   });
     * ```
     */
    edit(domainId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/email-security/settings/domains/${domainId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get an email domain
     *
     * @example
     * ```ts
     * const domain =
     *   await client.emailSecurity.settings.domains.get(2400, {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(domainId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/settings/domains/${domainId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DomainListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
export class DomainBulkDeleteResponsesSinglePage extends SinglePage {
}
Domains.DomainListResponsesV4PagePaginationArray = DomainListResponsesV4PagePaginationArray;
Domains.DomainBulkDeleteResponsesSinglePage = DomainBulkDeleteResponsesSinglePage;
//# sourceMappingURL=domains.mjs.map