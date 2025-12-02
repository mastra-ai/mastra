// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Quota extends APIResource {
    /**
     * Retrieves the current quota usage and limits for device commands within a
     * specific account, including the time when the quota will reset
     *
     * @example
     * ```ts
     * const quota = await client.zeroTrust.dex.commands.quota.get(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dex/commands/quota`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=quota.mjs.map