// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class ForceAXFRResource extends APIResource {
    /**
     * Sends AXFR zone transfer request to primary nameserver(s).
     *
     * @example
     * ```ts
     * const forceAXFR =
     *   await client.dns.zoneTransfers.forceAXFR.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/force_axfr`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=force-axfr.mjs.map