// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class AccountMapping extends APIResource {
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
//# sourceMappingURL=account-mapping.mjs.map