// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as LatestAPI from "./latest.mjs";
import { Latest } from "./latest.mjs";
export class Events extends APIResource {
    constructor() {
        super(...arguments);
        this.latest = new LatestAPI.Latest(this._client);
    }
    /**
     * List Events
     *
     * @example
     * ```ts
     * const events =
     *   await client.magicTransit.connectors.events.list(
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
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Event
     *
     * @example
     * ```ts
     * const event =
     *   await client.magicTransit.connectors.events.get(
     *     'connector_id',
     *     0,
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(connectorId, eventT, eventN, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events/${eventT}.${eventN}`, options)._thenUnwrap((obj) => obj.result);
    }
}
Events.Latest = Latest;
//# sourceMappingURL=events.mjs.map