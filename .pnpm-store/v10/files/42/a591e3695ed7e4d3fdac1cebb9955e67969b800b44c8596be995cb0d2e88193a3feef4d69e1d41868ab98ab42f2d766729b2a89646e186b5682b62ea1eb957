// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Status extends APIResource {
    /**
     * Get primary zone transfer status.
     *
     * @example
     * ```ts
     * const enableTransfer =
     *   await client.dns.zoneTransfers.outgoing.status.get({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/secondary_dns/outgoing/status`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=status.mjs.map