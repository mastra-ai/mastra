"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schemas = void 0;
const resource_1 = require("../../resource.js");
class Schemas extends resource_1.APIResource {
    /**
     * Retrieve operations and features as OpenAPI schemas
     *
     * @example
     * ```ts
     * const schemas = await client.apiGateway.schemas.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/schemas`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Schemas = Schemas;
//# sourceMappingURL=schemas.js.map