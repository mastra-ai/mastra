"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionsSinglePage = exports.Connections = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Connections extends resource_1.APIResource {
    /**
     * Lists all connections detected by Page Shield.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const connection of client.pageShield.connections.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/page_shield/connections`, ConnectionsSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Fetches a connection detected by Page Shield by connection ID.
     *
     * @example
     * ```ts
     * const connection = await client.pageShield.connections.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(connectionId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/page_shield/connections/${connectionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Connections = Connections;
class ConnectionsSinglePage extends pagination_1.SinglePage {
}
exports.ConnectionsSinglePage = ConnectionsSinglePage;
Connections.ConnectionsSinglePage = ConnectionsSinglePage;
//# sourceMappingURL=connections.js.map