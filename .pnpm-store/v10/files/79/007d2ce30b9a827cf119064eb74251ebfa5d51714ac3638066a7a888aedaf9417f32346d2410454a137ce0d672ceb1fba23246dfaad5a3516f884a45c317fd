// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { CustomCertificatesSinglePage } from "./custom-certificates.mjs";
export class Prioritize extends APIResource {
    /**
     * If a zone has multiple SSL certificates, you can set the order in which they
     * should be used during a request. The higher priority will break ties across
     * overlapping 'legacy_custom' certificates.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const customCertificate of client.customCertificates.prioritize.update(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificates: [{}, {}],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/custom_certificates/prioritize`, CustomCertificatesSinglePage, { body, method: 'put', ...options });
    }
}
export { CustomCertificatesSinglePage };
//# sourceMappingURL=prioritize.mjs.map