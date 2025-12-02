"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackDomainsSinglePage = exports.FallbackDomains = void 0;
const resource_1 = require("../../../../../resource.js");
const policies_1 = require("../policies.js");
Object.defineProperty(exports, "FallbackDomainsSinglePage", { enumerable: true, get: function () { return policies_1.FallbackDomainsSinglePage; } });
class FallbackDomains extends resource_1.APIResource {
    /**
     * Sets the list of domains to bypass Gateway DNS resolution. These domains will
     * use the specified local DNS resolver instead.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fallbackDomain of client.zeroTrust.devices.policies.default.fallbackDomains.update(
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     domains: [{ suffix: 'example.com' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { account_id, domains } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/fallback_domains`, policies_1.FallbackDomainsSinglePage, { body: domains, method: 'put', ...options });
    }
    /**
     * Fetches a list of domains to bypass Gateway DNS resolution. These domains will
     * use the specified local DNS resolver instead.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fallbackDomain of client.zeroTrust.devices.policies.default.fallbackDomains.get(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/fallback_domains`, policies_1.FallbackDomainsSinglePage, options);
    }
}
exports.FallbackDomains = FallbackDomains;
//# sourceMappingURL=fallback-domains.js.map