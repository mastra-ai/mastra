"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLSGetResponsesSinglePage = exports.TLS = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class TLS extends resource_1.APIResource {
    /**
     * Update the tls setting value for the hostname.
     *
     * @example
     * ```ts
     * const setting = await client.hostnames.settings.tls.update(
     *   'ciphers',
     *   'app.example.com',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     value: [
     *       'ECDHE-RSA-AES128-GCM-SHA256',
     *       'AES128-GCM-SHA256',
     *     ],
     *   },
     * );
     * ```
     */
    update(settingId, hostname, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/hostnames/settings/${settingId}/${hostname}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete the tls setting value for the hostname.
     *
     * @example
     * ```ts
     * const tls = await client.hostnames.settings.tls.delete(
     *   'ciphers',
     *   'app.example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(settingId, hostname, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/hostnames/settings/${settingId}/${hostname}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * List the requested TLS setting for the hostnames under this zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tlsGetResponse of client.hostnames.settings.tls.get(
     *   'ciphers',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(settingId, params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/hostnames/settings/${settingId}`, TLSGetResponsesSinglePage, options);
    }
}
exports.TLS = TLS;
class TLSGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TLSGetResponsesSinglePage = TLSGetResponsesSinglePage;
TLS.TLSGetResponsesSinglePage = TLSGetResponsesSinglePage;
//# sourceMappingURL=tls.js.map