// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as LatestAPI from "./latest.mjs";
import { Latest } from "./latest.mjs";
export class Snapshots extends APIResource {
    constructor() {
        super(...arguments);
        this.latest = new LatestAPI.Latest(this._client);
    }
    /**
     * List Snapshots
     *
     * @example
     * ```ts
     * const snapshots =
     *   await client.magicTransit.connectors.snapshots.list(
     *     'connector_id',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       from: 0,
     *       to: 0,
     *     },
     *   );
     * ```
     */
    list(connectorId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/snapshots`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Snapshot
     *
     * @example
     * ```ts
     * const snapshot =
     *   await client.magicTransit.connectors.snapshots.get(
     *     'connector_id',
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(connectorId, snapshotT, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/snapshots/${snapshotT}`, options)._thenUnwrap((obj) => obj.result);
    }
}
Snapshots.Latest = Latest;
//# sourceMappingURL=snapshots.mjs.map