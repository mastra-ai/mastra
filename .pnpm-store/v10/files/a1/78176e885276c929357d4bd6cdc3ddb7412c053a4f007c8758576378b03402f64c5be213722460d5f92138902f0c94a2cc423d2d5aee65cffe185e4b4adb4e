// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { FallbackDomainsSinglePage } from "../policies.mjs";
export class FallbackDomains extends APIResource {
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
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/fallback_domains`, FallbackDomainsSinglePage, { body: domains, method: 'put', ...options });
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
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/fallback_domains`, FallbackDomainsSinglePage, options);
    }
}
export { FallbackDomainsSinglePage };
//# sourceMappingURL=fallback-domains.mjs.map