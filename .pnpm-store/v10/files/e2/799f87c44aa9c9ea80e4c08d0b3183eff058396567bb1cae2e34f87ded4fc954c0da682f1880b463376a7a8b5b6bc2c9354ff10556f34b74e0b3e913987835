"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASNs = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
class ASNs extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/entities/asns', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(asn, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
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
        if ((0, core_1.isRequestOptions)(query)) {
            return this.rel(asn, {}, query);
        }
        return this._client.get(`/radar/entities/asns/${asn}/rel`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.ASNs = ASNs;
//# sourceMappingURL=asns.js.map