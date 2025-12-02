// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Value extends APIResource {
    /**
     * Roll the Account Owned API token secret.
     *
     * @example
     * ```ts
     * const tokenValue =
     *   await client.accounts.tokens.value.update(
     *     'ed17574386854bf78a67040be0a770b0',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {},
     *     },
     *   );
     * ```
     */
    update(tokenId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/tokens/${tokenId}/value`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=value.mjs.map