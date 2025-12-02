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
exports.Configurations = void 0;
const resource_1 = require("../../../../resource.js");
const CustomCertificateAPI = __importStar(require("./custom-certificate.js"));
const custom_certificate_1 = require("./custom-certificate.js");
class Configurations extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.customCertificate = new CustomCertificateAPI.CustomCertificate(this._client);
    }
    /**
     * Updates the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/configuration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches the current Zero Trust account configuration. This endpoint can update a
     * single subcollection of settings such as `antivirus`, `tls_decrypt`,
     * `activity_log`, `block_page`, `browser_isolation`, `fips`, `body_scanning`, or
     * `certificate`, without updating the entire configuration object. Returns an
     * error if any collection of settings is not properly configured.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.gateway.configurations.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/gateway/configuration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/configuration`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Configurations = Configurations;
Configurations.CustomCertificate = custom_certificate_1.CustomCertificate;
//# sourceMappingURL=configurations.js.map