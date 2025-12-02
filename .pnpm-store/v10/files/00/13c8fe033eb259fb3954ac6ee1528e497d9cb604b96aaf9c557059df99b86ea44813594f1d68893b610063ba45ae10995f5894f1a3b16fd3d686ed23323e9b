"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Countries = void 0;
const resource_1 = require("../../../resource.js");
class Countries extends resource_1.APIResource {
    /**
     * Retrieves countries information for all countries
     *
     * @example
     * ```ts
     * const countries =
     *   await client.cloudforceOne.threatEvents.countries.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/countries`, options);
    }
}
exports.Countries = Countries;
//# sourceMappingURL=countries.js.map