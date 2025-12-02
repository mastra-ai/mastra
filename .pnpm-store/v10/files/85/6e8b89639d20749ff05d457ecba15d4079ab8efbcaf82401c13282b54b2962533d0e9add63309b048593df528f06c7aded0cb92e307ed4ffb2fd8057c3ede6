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
exports.SettingsPoliciesSinglePage = exports.Custom = void 0;
const resource_1 = require("../../../../../resource.js");
const policies_1 = require("../policies.js");
Object.defineProperty(exports, "SettingsPoliciesSinglePage", { enumerable: true, get: function () { return policies_1.SettingsPoliciesSinglePage; } });
const ExcludesAPI = __importStar(require("./excludes.js"));
const excludes_1 = require("./excludes.js");
const FallbackDomainsAPI = __importStar(require("./fallback-domains.js"));
const fallback_domains_1 = require("./fallback-domains.js");
const IncludesAPI = __importStar(require("./includes.js"));
const includes_1 = require("./includes.js");
class Custom extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.excludes = new ExcludesAPI.Excludes(this._client);
        this.includes = new IncludesAPI.Includes(this._client);
        this.fallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);
    }
    /**
     * Creates a device settings profile to be applied to certain devices matching the
     * criteria.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     match: 'identity.email == "test@cloudflare.com"',
     *     name: 'Allow Developers',
     *     precedence: 100,
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/policy`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a list of the device settings profiles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policies`, policies_1.SettingsPoliciesSinglePage, options);
    }
    /**
     * Deletes a device settings profile and fetches a list of the remaining profiles
     * for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(policyId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}`, policies_1.SettingsPoliciesSinglePage, { method: 'delete', ...options });
    }
    /**
     * Updates a configured device settings profile.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(policyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/policy/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a device settings profile by ID.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/policy/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Custom = Custom;
Custom.Excludes = excludes_1.Excludes;
Custom.Includes = includes_1.Includes;
Custom.FallbackDomains = fallback_domains_1.FallbackDomains;
//# sourceMappingURL=custom.js.map