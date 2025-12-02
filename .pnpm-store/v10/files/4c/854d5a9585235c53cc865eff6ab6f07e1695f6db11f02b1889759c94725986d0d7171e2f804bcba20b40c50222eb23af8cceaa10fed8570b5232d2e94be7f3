"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueDevices = void 0;
const resource_1 = require("../../../../resource.js");
class UniqueDevices extends resource_1.APIResource {
    /**
     * Returns unique count of devices that have run synthetic application monitoring
     * tests in the past 7 days.
     *
     * @example
     * ```ts
     * const uniqueDevices =
     *   await client.zeroTrust.dex.tests.uniqueDevices.list({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/tests/unique-devices`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.UniqueDevices = UniqueDevices;
//# sourceMappingURL=unique-devices.js.map