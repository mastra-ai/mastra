"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostnameUpdateResponsesSinglePage = exports.Hostnames = void 0;
const resource_1 = require("../../../resource.js");
const CertificatesAPI = __importStar(require("./certificates.js"));
const certificates_1 = require("./certificates.js");
const pagination_1 = require("../../../pagination.js");
class Hostnames extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.certificates = new CertificatesAPI.Certificates(this._client);
    }
    /**
     * Associate a hostname to a certificate and enable, disable or invalidate the
     * association. If disabled, client certificate will not be sent to the hostname
     * even if activated at the zone level. 100 maximum associations on a single
     * certificate are allowed. Note: Use a null value for parameter _enabled_ to
     * invalidate the association.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hostnameUpdateResponse of client.originTLSClientAuth.hostnames.update(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     config: [{}],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/origin_tls_client_auth/hostnames`, HostnameUpdateResponsesSinglePage, { body, method: 'put', ...options });
    }
    /**
     * Get the Hostname Status for Client Authentication
     *
     * @example
     * ```ts
     * const authenticatedOriginPull =
     *   await client.originTLSClientAuth.hostnames.get(
     *     'app.example.com',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(hostname, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/origin_tls_client_auth/hostnames/${hostname}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Hostnames = Hostnames;
class HostnameUpdateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.HostnameUpdateResponsesSinglePage = HostnameUpdateResponsesSinglePage;
Hostnames.HostnameUpdateResponsesSinglePage = HostnameUpdateResponsesSinglePage;
Hostnames.Certificates = certificates_1.Certificates;
Hostnames.CertificateListResponsesSinglePage = certificates_1.CertificateListResponsesSinglePage;
//# sourceMappingURL=hostnames.js.map