"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quota = void 0;
const resource_1 = require("../../../../resource.js");
class Quota extends resource_1.APIResource {
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
exports.Quota = Quota;
//# sourceMappingURL=quota.js.map