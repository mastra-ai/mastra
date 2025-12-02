// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Quota extends APIResource {
    /**
     * Lists the number of secrets used in the account.
     *
     * @example
     * ```ts
     * const quota = await client.secretsStore.quota.get({
     *   account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/secrets_store/quota`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=quota.mjs.map