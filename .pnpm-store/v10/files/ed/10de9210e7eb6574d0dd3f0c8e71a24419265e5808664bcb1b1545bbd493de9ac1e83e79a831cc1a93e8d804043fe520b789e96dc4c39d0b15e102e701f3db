"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Results = void 0;
const resource_1 = require("../../../resource.js");
class Results extends resource_1.APIResource {
    /**
     * Get the Latest Scan Result
     *
     * @example
     * ```ts
     * const result = await client.cloudforceOne.scans.results.get(
     *   'config_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(configId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/scans/results/${configId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Results = Results;
//# sourceMappingURL=results.js.map