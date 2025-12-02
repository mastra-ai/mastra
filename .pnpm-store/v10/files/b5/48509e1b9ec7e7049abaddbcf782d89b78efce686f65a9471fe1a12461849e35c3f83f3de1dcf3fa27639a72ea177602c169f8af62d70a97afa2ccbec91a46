"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeylessCertificatesSinglePage = exports.KeylessCertificates = void 0;
const resource_1 = require("../resource.js");
const pagination_1 = require("../pagination.js");
class KeylessCertificates extends resource_1.APIResource {
    /**
     * Create Keyless SSL Configuration
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificate:
     *       '-----BEGIN CERTIFICATE----- MIIDtTCCAp2gAwIBAgIJAM15n7fdxhRtMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV BAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX aWRnaXRzIFB0eSBMdGQwHhcNMTQwMzExMTkyMTU5WhcNMTQwNDEwMTkyMTU5WjBF MQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50 ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB CgKCAQEAvq3sKsHpeduJHimOK+fvQdKsI8z8A05MZyyLp2/R/GE8FjNv+hkVY1WQ LIyTNNQH7CJecE1nbTfo8Y56S7x/rhxC6/DJ8MIulapFPnorq46KU6yRxiM0MQ3N nTJHlHA2ozZta6YBBfVfhHWl1F0IfNbXCLKvGwWWMbCx43OfW6KTkbRnE6gFWKuO fSO5h2u5TaWVuSIzBvYs7Vza6m+gtYAvKAJV2nSZ+eSEFPDo29corOy8+huEOUL8 5FAw4BFPsr1TlrlGPFitduQUHGrSL7skk1ESGza0to3bOtrodKei2s9bk5MXm7lZ qI+WZJX4Zu9+mzZhc9pCVi8r/qlXuQIDAQABo4GnMIGkMB0GA1UdDgQWBBRvavf+ sWM4IwKiH9X9w1vl6nUVRDB1BgNVHSMEbjBsgBRvavf+sWM4IwKiH9X9w1vl6nUV RKFJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNV BAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAM15n7fdxhRtMAwGA1UdEwQF MAMBAf8wDQYJKoZIhvcNAQEFBQADggEBABY2ZzBaW0dMsAAT7tPJzrVWVzQx6KU4 UEBLudIlWPlkAwTnINCWR/8eNjCCmGA4heUdHmazdpPa8RzwOmc0NT1NQqzSyktt vTqb4iHD7+8f9MqJ9/FssCfTtqr/Qst/hGH4Wmdf1EJ/6FqYAAb5iRlPgshFZxU8 uXtA8hWn6fK6eISD9HBdcAFToUvKNZ1BIDPvh9f95Ine8ar6yGd56TUNrHR8eHBs ESxz5ddVR/oWRysNJ+aGAyYqHS8S/ttmC7r4XCAHqXptkHPCGRqkAhsterYhd4I8 /cBzejUobNCjjHFbtkAL/SjxZOLW+pNkZwfeYdM8iPkD54Uua1v2tdw= -----END CERTIFICATE-----',
     *     host: 'example.com',
     *     port: 24008,
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/keyless_certificates`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all Keyless SSL configurations for a given zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const keylessCertificate of client.keylessCertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/keyless_certificates`, KeylessCertificatesSinglePage, options);
    }
    /**
     * Delete Keyless SSL Configuration
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(keylessCertificateId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/keyless_certificates/${keylessCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * This will update attributes of a Keyless SSL. Consists of one or more of the
     * following: host,name,port.
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.edit(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(keylessCertificateId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/keyless_certificates/${keylessCertificateId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get details for one Keyless SSL configuration.
     *
     * @example
     * ```ts
     * const keylessCertificate =
     *   await client.keylessCertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(keylessCertificateId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/keyless_certificates/${keylessCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.KeylessCertificates = KeylessCertificates;
class KeylessCertificatesSinglePage extends pagination_1.SinglePage {
}
exports.KeylessCertificatesSinglePage = KeylessCertificatesSinglePage;
KeylessCertificates.KeylessCertificatesSinglePage = KeylessCertificatesSinglePage;
//# sourceMappingURL=keyless-certificates.js.map