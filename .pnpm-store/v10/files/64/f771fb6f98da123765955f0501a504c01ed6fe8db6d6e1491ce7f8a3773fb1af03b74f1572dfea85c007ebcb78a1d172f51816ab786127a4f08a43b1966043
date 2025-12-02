// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class ImpersonationRegistry extends APIResource {
    /**
     * Create an entry in impersonation registry
     *
     * @example
     * ```ts
     * const impersonationRegistry =
     *   await client.emailSecurity.settings.impersonationRegistry.create(
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       email: 'email',
     *       is_email_regex: true,
     *       name: 'name',
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/settings/impersonation_registry`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists, searches, and sorts entries in the impersonation registry.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const impersonationRegistryListResponse of client.emailSecurity.settings.impersonationRegistry.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/impersonation_registry`, ImpersonationRegistryListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete an entry from impersonation registry
     *
     * @example
     * ```ts
     * const impersonationRegistry =
     *   await client.emailSecurity.settings.impersonationRegistry.delete(
     *     2403,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(displayNameId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an entry in impersonation registry
     *
     * @example
     * ```ts
     * const response =
     *   await client.emailSecurity.settings.impersonationRegistry.edit(
     *     2403,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(displayNameId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get an entry in impersonation registry
     *
     * @example
     * ```ts
     * const impersonationRegistry =
     *   await client.emailSecurity.settings.impersonationRegistry.get(
     *     2403,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(displayNameId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ImpersonationRegistryListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
ImpersonationRegistry.ImpersonationRegistryListResponsesV4PagePaginationArray =
    ImpersonationRegistryListResponsesV4PagePaginationArray;
//# sourceMappingURL=impersonation-registry.mjs.map