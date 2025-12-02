"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryOperationsV4PagePaginationArray = exports.Operations = void 0;
const resource_1 = require("../../../resource.js");
const discovery_1 = require("./discovery.js");
Object.defineProperty(exports, "DiscoveryOperationsV4PagePaginationArray", { enumerable: true, get: function () { return discovery_1.DiscoveryOperationsV4PagePaginationArray; } });
class Operations extends resource_1.APIResource {
    /**
     * Retrieve the most up to date view of discovered operations
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const discoveryOperation of client.apiGateway.discovery.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/discovery/operations`, discovery_1.DiscoveryOperationsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Update the `state` on one or more discovered operations
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.discovery.operations.bulkEdit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {
     *       '3818d821-5901-4147-a474-f5f5aec1d54e': {},
     *       'b17c8043-99a0-4202-b7d9-8f7cdbee02cd': {},
     *     },
     *   });
     * ```
     */
    bulkEdit(params, options) {
        const { zone_id, body } = params;
        return this._client.patch(`/zones/${zone_id}/api_gateway/discovery/operations`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update the `state` on a discovered operation
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.discovery.operations.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(operationId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/api_gateway/discovery/operations/${operationId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Operations = Operations;
//# sourceMappingURL=operations.js.map