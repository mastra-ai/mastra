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
exports.Default = void 0;
const resource_1 = require("../../../../../resource.js");
const CertificatesAPI = __importStar(require("./certificates.js"));
const certificates_1 = require("./certificates.js");
const ExcludesAPI = __importStar(require("./excludes.js"));
const excludes_1 = require("./excludes.js");
const FallbackDomainsAPI = __importStar(require("./fallback-domains.js"));
const fallback_domains_1 = require("./fallback-domains.js");
const IncludesAPI = __importStar(require("./includes.js"));
const includes_1 = require("./includes.js");
class Default extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.excludes = new ExcludesAPI.Excludes(this._client);
        this.includes = new IncludesAPI.Includes(this._client);
        this.fallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);
        this.certificates = new CertificatesAPI.Certificates(this._client);
    }
    /**
     * Updates the default device settings profile for an account.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.policies.default.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/policy`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the default device settings profile for an account.
     *
     * @example
     * ```ts
     * const _default =
     *   await client.zeroTrust.devices.policies.default.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/policy`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Default = Default;
Default.Excludes = excludes_1.Excludes;
Default.Includes = includes_1.Includes;
Default.FallbackDomains = fallback_domains_1.FallbackDomains;
Default.Certificates = certificates_1.Certificates;
//# sourceMappingURL=default.js.map