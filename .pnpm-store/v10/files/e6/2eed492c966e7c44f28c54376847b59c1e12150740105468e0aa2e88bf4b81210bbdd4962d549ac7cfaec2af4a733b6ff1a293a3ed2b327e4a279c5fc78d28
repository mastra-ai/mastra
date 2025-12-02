"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountMapping = void 0;
const resource_1 = require("../../../../resource.js");
class AccountMapping extends resource_1.APIResource {
    /**
     * Create mapping
     *
     * @example
     * ```ts
     * const accountMapping =
     *   await client.zeroTrust.dlp.email.accountMapping.create({
     *     account_id: 'account_id',
     *     auth_requirements: {
     *       allowed_microsoft_organizations: ['string'],
     *       type: 'Org',
     *     },
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/email/account_mapping`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get mapping
     *
     * @example
     * ```ts
     * const accountMapping =
     *   await client.zeroTrust.dlp.email.accountMapping.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/email/account_mapping`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.AccountMapping = AccountMapping;
//# sourceMappingURL=account-mapping.js.map