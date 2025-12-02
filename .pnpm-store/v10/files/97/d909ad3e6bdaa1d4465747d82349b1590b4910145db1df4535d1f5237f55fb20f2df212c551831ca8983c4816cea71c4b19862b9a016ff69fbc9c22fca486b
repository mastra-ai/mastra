"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinkholesSinglePage = exports.Sinkholes = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Sinkholes extends resource_1.APIResource {
    /**
     * List sinkholes owned by this account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const sinkhole of client.intel.sinkholes.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/sinkholes`, SinkholesSinglePage, options);
    }
}
exports.Sinkholes = Sinkholes;
class SinkholesSinglePage extends pagination_1.SinglePage {
}
exports.SinkholesSinglePage = SinkholesSinglePage;
Sinkholes.SinkholesSinglePage = SinkholesSinglePage;
//# sourceMappingURL=sinkholes.js.map