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
exports.CustomHostnameListResponsesV4PagePaginationArray = exports.CustomHostnames = void 0;
const resource_1 = require("../../resource.js");
const FallbackOriginAPI = __importStar(require("./fallback-origin.js"));
const fallback_origin_1 = require("./fallback-origin.js");
const CertificatePackAPI = __importStar(require("./certificate-pack/certificate-pack.js"));
const certificate_pack_1 = require("./certificate-pack/certificate-pack.js");
const pagination_1 = require("../../pagination.js");
class CustomHostnames extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.fallbackOrigin = new FallbackOriginAPI.FallbackOrigin(this._client);
        this.certificatePack = new CertificatePackAPI.CertificatePack(this._client);
    }
    /**
     * Add a new custom hostname and request that an SSL certificate be issued for it.
     * One of three validation methods—http, txt, email—should be used, with 'http'
     * recommended if the CNAME is already in place (or will be soon). Specifying
     * 'email' will send an email to the WHOIS contacts on file for the base domain
     * plus hostmaster, postmaster, webmaster, admin, administrator. If http is used
     * and the domain is not already pointing to the Managed CNAME host, the PATCH
     * method must be used once it is (to complete validation). Enable bundling of
     * certificates using the custom_cert_bundle field. The bundling process requires
     * the following condition One certificate in the bundle must use an RSA, and the
     * other must use an ECDSA.
     *
     * @example
     * ```ts
     * const customHostname = await client.customHostnames.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   hostname: 'app.example.com',
     *   ssl: {},
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/custom_hostnames`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List, search, sort, and filter all of your custom hostnames.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customHostnameListResponse of client.customHostnames.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/custom_hostnames`, CustomHostnameListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete Custom Hostname (and any issued SSL certificates)
     *
     * @example
     * ```ts
     * const customHostname = await client.customHostnames.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(customHostnameId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, options);
    }
    /**
     * Modify SSL configuration for a custom hostname. When sent with SSL config that
     * matches existing config, used to indicate that hostname should pass domain
     * control validation (DCV). Can also be used to change validation type, e.g., from
     * 'http' to 'email'. Bundle an existing certificate with another certificate by
     * using the "custom_cert_bundle" field. The bundling process supports combining
     * certificates as long as the following condition is met. One certificate must use
     * the RSA algorithm, and the other must use the ECDSA algorithm.
     *
     * @example
     * ```ts
     * const response = await client.customHostnames.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(customHostnameId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Custom Hostname Details
     *
     * @example
     * ```ts
     * const customHostname = await client.customHostnames.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(customHostnameId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/custom_hostnames/${customHostnameId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.CustomHostnames = CustomHostnames;
class CustomHostnameListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.CustomHostnameListResponsesV4PagePaginationArray = CustomHostnameListResponsesV4PagePaginationArray;
CustomHostnames.CustomHostnameListResponsesV4PagePaginationArray =
    CustomHostnameListResponsesV4PagePaginationArray;
CustomHostnames.FallbackOrigin = fallback_origin_1.FallbackOrigin;
CustomHostnames.CertificatePack = certificate_pack_1.CertificatePack;
//# sourceMappingURL=custom-hostnames.js.map