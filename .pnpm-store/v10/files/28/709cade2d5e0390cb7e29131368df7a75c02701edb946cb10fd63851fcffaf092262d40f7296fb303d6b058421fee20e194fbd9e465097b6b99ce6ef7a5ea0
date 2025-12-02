"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schema = void 0;
const resource_1 = require("../../../resource.js");
class Schema extends resource_1.APIResource {
    /**
     * Get Model Schema
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/ai/models/schema`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Schema = Schema;
//# sourceMappingURL=schema.js.map