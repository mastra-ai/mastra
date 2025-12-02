"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateListResponsesSinglePage = exports.Certificates = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Certificates extends resource_1.APIResource {
    /**
     * Creates a new Zero Trust certificate.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.zeroTrust.gateway.certificates.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/certificates`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches all Zero Trust certificates for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateListResponse of client.zeroTrust.gateway.certificates.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/certificates`, CertificateListResponsesSinglePage, options);
    }
    /**
     * Deletes a gateway-managed Zero Trust certificate. A certificate must be
     * deactivated from the edge (inactive) before it is deleted.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.zeroTrust.gateway.certificates.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(certificateId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/gateway/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Binds a single Zero Trust certificate to the edge.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.gateway.certificates.activate(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       body: {},
     *     },
     *   );
     * ```
     */
    activate(certificateId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/certificates/${certificateId}/activate`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Unbinds a single Zero Trust certificate from the edge
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.gateway.certificates.deactivate(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       body: {},
     *     },
     *   );
     * ```
     */
    deactivate(certificateId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/certificates/${certificateId}/deactivate`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Zero Trust certificate.
     *
     * @example
     * ```ts
     * const certificate =
     *   await client.zeroTrust.gateway.certificates.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(certificateId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/certificates/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Certificates = Certificates;
class CertificateListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CertificateListResponsesSinglePage = CertificateListResponsesSinglePage;
Certificates.CertificateListResponsesSinglePage = CertificateListResponsesSinglePage;
//# sourceMappingURL=certificates.js.map