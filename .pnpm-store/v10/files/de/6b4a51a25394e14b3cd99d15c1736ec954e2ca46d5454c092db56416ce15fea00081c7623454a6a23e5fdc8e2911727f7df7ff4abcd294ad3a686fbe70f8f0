// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Limits extends APIResource {
    /**
     * Fetch limits associated with DLP for account
     *
     * @example
     * ```ts
     * const limits = await client.zeroTrust.dlp.limits.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/limits`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=limits.mjs.map