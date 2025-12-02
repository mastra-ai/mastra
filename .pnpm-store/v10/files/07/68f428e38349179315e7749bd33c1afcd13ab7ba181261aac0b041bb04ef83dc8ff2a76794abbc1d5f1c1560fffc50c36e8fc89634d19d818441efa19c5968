"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Miscategorizations = void 0;
const resource_1 = require("../../resource.js");
class Miscategorizations extends resource_1.APIResource {
    /**
     * Allows you to submit requests to change a domain’s category.
     *
     * @example
     * ```ts
     * const miscategorization =
     *   await client.intel.miscategorizations.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/intel/miscategorization`, { body, ...options });
    }
}
exports.Miscategorizations = Miscategorizations;
//# sourceMappingURL=miscategorizations.js.map