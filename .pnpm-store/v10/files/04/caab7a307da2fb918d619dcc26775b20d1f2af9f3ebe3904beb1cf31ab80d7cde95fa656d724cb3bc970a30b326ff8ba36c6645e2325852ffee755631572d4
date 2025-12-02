"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Full = void 0;
const resource_1 = require("../../../resource.js");
class Full extends resource_1.APIResource {
    /**
     * Lists default sampling, router IPs, warp devices, and rules for account.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.full.get({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mnm/config/full`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Full = Full;
//# sourceMappingURL=full.js.map