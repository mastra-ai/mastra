// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Certificates extends APIResource {
    /**
     * Replace a single custom certificate within a certificate pack that contains two
     * bundled certificates. The replacement must adhere to the following constraints.
     * You can only replace an RSA certificate with another RSA certificate or an ECDSA
     * certificate with another ECDSA certificate.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.customHostnames.certificatePack.certificates.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       custom_certificate:
     *         '-----BEGIN CERTIFICATE-----\nMIIDdjCCAl6gAwIBAgIJAPnMg0Fs+/B0MA0GCSqGSIb3DQEBCwUAMFsx...\n-----END CERTIFICATE-----\n',
     *       custom_key:
     *         '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/SCB5...\n-----END PRIVATE KEY-----\n',
     *     },
     *   );
     * ```
     */
    update(customHostnameId, certificatePackId, certificateId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/custom_hostnames/${customHostnameId}/certificate_pack/${certificatePackId}/certificates/${certificateId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a single custom certificate from a certificate pack that contains two
     * bundled certificates. Deletion is subject to the following constraints. You
     * cannot delete a certificate if it is the only remaining certificate in the pack.
     * At least one certificate must remain in the pack.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.customHostnames.certificatePack.certificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(customHostnameId, certificatePackId, certificateId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/custom_hostnames/${customHostnameId}/certificate_pack/${certificatePackId}/certificates/${certificateId}`, options);
    }
}
//# sourceMappingURL=certificates.mjs.map