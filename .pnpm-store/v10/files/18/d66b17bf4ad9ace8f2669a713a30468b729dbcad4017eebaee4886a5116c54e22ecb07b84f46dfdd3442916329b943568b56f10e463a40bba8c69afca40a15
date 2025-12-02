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
exports.MTLSCertificatesSinglePage = exports.MTLSCertificates = void 0;
const resource_1 = require("../../resource.js");
const AssociationsAPI = __importStar(require("./associations.js"));
const associations_1 = require("./associations.js");
const pagination_1 = require("../../pagination.js");
class MTLSCertificates extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.associations = new AssociationsAPI.Associations(this._client);
    }
    /**
     * Upload a certificate that you want to use with mTLS-enabled Cloudflare services.
     *
     * @example
     * ```ts
     * const mtlsCertificate =
     *   await client.mtlsCertificates.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     ca: true,
     *     certificates:
     *       '-----BEGIN CERTIFICATE-----\nMIIDmDCCAoCgAwIBAgIUKTOAZNjcXVZRj4oQt0SHsl1c1vMwDQYJKoZIhvcNAQELBQAwUTELMAkGA1UEBhMCVVMxFjAUBgNVBAgMDVNhbiBGcmFuY2lzY28xEzARBgNVBAcMCkNhbGlmb3JuaWExFTATBgNVBAoMDEV4YW1wbGUgSW5jLjAgFw0yMjExMjIxNjU5NDdaGA8yMTIyMTAyOTE2NTk0N1owUTELMAkGA1UEBhMCVVMxFjAUBgNVBAgMDVNhbiBGcmFuY2lzY28xEzARBgNVBAcMCkNhbGlmb3JuaWExFTATBgNVBAoMDEV4YW1wbGUgSW5jLjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMRcORwgJFTdcG/2GKI+cFYiOBNDKjCZUXEOvXWY42BkH9wxiMT869CO+enA1w5pIrXow6kCM1sQspHHaVmJUlotEMJxyoLFfA/8Kt1EKFyobOjuZs2SwyVyJ2sStvQuUQEosULZCNGZEqoH5g6zhMPxaxm7ZLrrsDZ9maNGVqo7EWLWHrZ57Q/5MtTrbxQL+eXjUmJ9K3kS+3uEwMdqR6Z3BluU1ivanpPc1CN2GNhdO0/hSY4YkGEnuLsqJyDd3cIiB1MxuCBJ4ZaqOd2viV1WcP3oU3dxVPm4MWyfYIldMWB14FahScxLhWdRnM9YZ/i9IFcLypXsuz7DjrJPtPUCAwEAAaNmMGQwHQYDVR0OBBYEFP5JzLUawNF+c3AXsYTEWHh7z2czMB8GA1UdIwQYMBaAFP5JzLUawNF+c3AXsYTEWHh7z2czMA4GA1UdDwEB/wQEAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEBMA0GCSqGSIb3DQEBCwUAA4IBAQBc+Be7NDhpE09y7hLPZGRPl1cSKBw4RI0XIv6rlbSTFs5EebpTGjhx/whNxwEZhB9HZ7111Oa1YlT8xkI9DshB78mjAHCKBAJ76moK8tkG0aqdYpJ4ZcJTVBB7l98Rvgc7zfTii7WemTy72deBbSeiEtXavm4EF0mWjHhQ5Nxpnp00Bqn5g1x8CyTDypgmugnep+xG+iFzNmTdsz7WI9T/7kDMXqB7M/FPWBORyS98OJqNDswCLF8bIZYwUBEe+bRHFomoShMzaC3tvim7WCb16noDkSTMlfKO4pnvKhpcVdSgwcruATV7y+W+Lvmz2OT/Gui4JhqeoTewsxndhDDE\n-----END CERTIFICATE-----',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/mtls_certificates`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all mTLS certificates.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const mtlsCertificate of client.mtlsCertificates.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/mtls_certificates`, MTLSCertificatesSinglePage, options);
    }
    /**
     * Deletes the mTLS certificate unless the certificate is in use by one or more
     * Cloudflare services.
     *
     * @example
     * ```ts
     * const mtlsCertificate =
     *   await client.mtlsCertificates.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(mtlsCertificateId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/mtls_certificates/${mtlsCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single mTLS certificate.
     *
     * @example
     * ```ts
     * const mtlsCertificate = await client.mtlsCertificates.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(mtlsCertificateId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mtls_certificates/${mtlsCertificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.MTLSCertificates = MTLSCertificates;
class MTLSCertificatesSinglePage extends pagination_1.SinglePage {
}
exports.MTLSCertificatesSinglePage = MTLSCertificatesSinglePage;
MTLSCertificates.MTLSCertificatesSinglePage = MTLSCertificatesSinglePage;
MTLSCertificates.Associations = associations_1.Associations;
MTLSCertificates.CertificateAsssociationsSinglePage = associations_1.CertificateAsssociationsSinglePage;
//# sourceMappingURL=mtls-certificates.js.map