// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { V4PagePaginationArray } from "../pagination.mjs";
export class OriginCACertificates extends APIResource {
    /**
     * Create an Origin CA certificate. You can use an Origin CA Key as your User
     * Service Key or an API token when calling this endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.create();
     * ```
     */
    create(body, options) {
        return this._client.post('/certificates', { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all existing Origin CA certificates for a given zone. You can use an Origin
     * CA Key as your User Service Key or an API token when calling this endpoint
     * ([see above](#requests)).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const originCACertificate of client.originCACertificates.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(query, options) {
        return this._client.getAPIList('/certificates', OriginCACertificatesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Revoke an existing Origin CA certificate by its serial number. You can use an
     * Origin CA Key as your User Service Key or an API token when calling this
     * endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *   );
     * ```
     */
    delete(certificateId, options) {
        return this._client.delete(`/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get an existing Origin CA certificate by its serial number. You can use an
     * Origin CA Key as your User Service Key or an API token when calling this
     * endpoint ([see above](#requests)).
     *
     * @example
     * ```ts
     * const originCACertificate =
     *   await client.originCACertificates.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *   );
     * ```
     */
    get(certificateId, options) {
        return this._client.get(`/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class OriginCACertificatesV4PagePaginationArray extends V4PagePaginationArray {
}
OriginCACertificates.OriginCACertificatesV4PagePaginationArray = OriginCACertificatesV4PagePaginationArray;
//# sourceMappingURL=origin-ca-certificates.mjs.map