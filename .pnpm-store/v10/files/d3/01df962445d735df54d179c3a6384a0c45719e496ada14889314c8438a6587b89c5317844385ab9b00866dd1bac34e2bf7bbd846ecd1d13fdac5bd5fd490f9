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
exports.CertificatePackListResponsesSinglePage = exports.CertificatePacks = void 0;
const resource_1 = require("../../../resource.js");
const QuotaAPI = __importStar(require("./quota.js"));
const quota_1 = require("./quota.js");
const pagination_1 = require("../../../pagination.js");
class CertificatePacks extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.quota = new QuotaAPI.Quota(this._client);
    }
    /**
     * For a given zone, order an advanced certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     certificate_authority: 'lets_encrypt',
     *     hosts: [
     *       'example.com',
     *       '*.example.com',
     *       'www.example.com',
     *     ],
     *     type: 'advanced',
     *     validation_method: 'txt',
     *     validity_days: 14,
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/ssl/certificate_packs/order`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * For a given zone, list all active certificate packs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificatePackListResponse of client.ssl.certificatePacks.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/ssl/certificate_packs`, CertificatePackListResponsesSinglePage, { query, ...options });
    }
    /**
     * For a given zone, delete an advanced certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(certificatePackId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/ssl/certificate_packs/${certificatePackId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * For a given zone, restart validation or add cloudflare branding for an advanced
     * certificate pack. The former is only a validation operation for a Certificate
     * Pack in a validation_timed_out status.
     *
     * @example
     * ```ts
     * const response = await client.ssl.certificatePacks.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(certificatePackId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/ssl/certificate_packs/${certificatePackId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * For a given zone, get a certificate pack.
     *
     * @example
     * ```ts
     * const certificatePack =
     *   await client.ssl.certificatePacks.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(certificatePackId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/ssl/certificate_packs/${certificatePackId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.CertificatePacks = CertificatePacks;
class CertificatePackListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CertificatePackListResponsesSinglePage = CertificatePackListResponsesSinglePage;
CertificatePacks.CertificatePackListResponsesSinglePage = CertificatePackListResponsesSinglePage;
CertificatePacks.Quota = quota_1.Quota;
//# sourceMappingURL=certificate-packs.js.map