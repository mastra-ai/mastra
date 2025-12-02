// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Connections extends APIResource {
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
export class ConnectionsSinglePage extends SinglePage {
}
Connections.ConnectionsSinglePage = ConnectionsSinglePage;
//# sourceMappingURL=connections.mjs.map