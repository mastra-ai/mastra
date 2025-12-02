"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowPolicyListResponsesV4PagePaginationArray = exports.AllowPolicies = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class AllowPolicies extends resource_1.APIResource {
    /**
     * Create an email allow policy
     *
     * @example
     * ```ts
     * const allowPolicy =
     *   await client.emailSecurity.settings.allowPolicies.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     is_acceptable_sender: false,
     *     is_exempt_recipient: false,
     *     is_regex: false,
     *     is_trusted_sender: true,
     *     pattern: 'test@example.com',
     *     pattern_type: 'EMAIL',
     *     verify_sender: true,
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/settings/allow_policies`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists, searches, and sorts an account’s email allow policies.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const allowPolicyListResponse of client.emailSecurity.settings.allowPolicies.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/settings/allow_policies`, AllowPolicyListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete an email allow policy
     *
     * @example
     * ```ts
     * const allowPolicy =
     *   await client.emailSecurity.settings.allowPolicies.delete(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(policyId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/email-security/settings/allow_policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an email allow policy
     *
     * @example
     * ```ts
     * const response =
     *   await client.emailSecurity.settings.allowPolicies.edit(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(policyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/email-security/settings/allow_policies/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get an email allow policy
     *
     * @example
     * ```ts
     * const allowPolicy =
     *   await client.emailSecurity.settings.allowPolicies.get(
     *     2401,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/settings/allow_policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.AllowPolicies = AllowPolicies;
class AllowPolicyListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.AllowPolicyListResponsesV4PagePaginationArray = AllowPolicyListResponsesV4PagePaginationArray;
AllowPolicies.AllowPolicyListResponsesV4PagePaginationArray = AllowPolicyListResponsesV4PagePaginationArray;
//# sourceMappingURL=allow-policies.js.map