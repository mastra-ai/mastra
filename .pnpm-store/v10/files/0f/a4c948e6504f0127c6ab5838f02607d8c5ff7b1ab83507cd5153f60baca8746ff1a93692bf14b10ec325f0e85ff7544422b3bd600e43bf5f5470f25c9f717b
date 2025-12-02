"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Certificates = void 0;
const resource_1 = require("../../../../../resource.js");
class Certificates extends resource_1.APIResource {
    /**
     * Enable Zero Trust Clients to provision a certificate, containing a x509 subject,
     * and referenced by Access device posture policies when the client visits MTLS
     * protected domains. This facilitates device posture without a WARP session.
     *
     * @example
     * ```ts
     * const devicePolicyCertificates =
     *   await client.zeroTrust.devices.policies.default.certificates.edit(
     *     {
     *       zone_id: '699d98642c564d2e855e9661899b7252',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/devices/policy/certificates`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches device certificate provisioning.
     *
     * @example
     * ```ts
     * const devicePolicyCertificates =
     *   await client.zeroTrust.devices.policies.default.certificates.get(
     *     { zone_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/devices/policy/certificates`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Certificates = Certificates;
//# sourceMappingURL=certificates.js.map