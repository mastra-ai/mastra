"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quota = void 0;
const resource_1 = require("../../resource.js");
class Quota extends resource_1.APIResource {
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
exports.Quota = Quota;
//# sourceMappingURL=quota.js.map