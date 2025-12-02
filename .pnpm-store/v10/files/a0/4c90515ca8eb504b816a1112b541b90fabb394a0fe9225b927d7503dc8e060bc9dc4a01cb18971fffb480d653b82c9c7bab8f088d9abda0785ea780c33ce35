// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
export class ASNs extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/entities/asns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(asn, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(asn, {}, query);
        }
        return this._client.get(`/radar/entities/asns/${asn}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves the requested autonomous system information based on IP address.
     * Population estimates come from APNIC (refer to https://labs.apnic.net/?p=526).
     *
     * @example
     * ```ts
     * const response = await client.radar.entities.asns.ip({
     *   ip: '8.8.8.8',
     * });
     * ```
     */
    ip(query, options) {
        return this._client.get('/radar/entities/asns/ip', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    rel(asn, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.rel(asn, {}, query);
        }
        return this._client.get(`/radar/entities/asns/${asn}/rel`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=asns.mjs.map