// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Latest extends APIResource {
    /**
     * Get latest Events
     *
     * @example
     * ```ts
     * const latests =
     *   await client.magicTransit.connectors.events.latest.list(
     *     'connector_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(connectorId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events/latest`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=latest.mjs.map