// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as FallbackOriginAPI from "./fallback-origin.mjs";
import { FallbackOrigin, } from "./fallback-origin.mjs";
import * as CertificatePackAPI from "./certificate-pack/certificate-pack.mjs";
import { CertificatePack } from "./certificate-pack/certificate-pack.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class CustomHostnames extends APIResource {
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
export class CustomHostnameListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
CustomHostnames.CustomHostnameListResponsesV4PagePaginationArray =
    CustomHostnameListResponsesV4PagePaginationArray;
CustomHostnames.FallbackOrigin = FallbackOrigin;
CustomHostnames.CertificatePack = CertificatePack;
//# sourceMappingURL=custom-hostnames.mjs.map