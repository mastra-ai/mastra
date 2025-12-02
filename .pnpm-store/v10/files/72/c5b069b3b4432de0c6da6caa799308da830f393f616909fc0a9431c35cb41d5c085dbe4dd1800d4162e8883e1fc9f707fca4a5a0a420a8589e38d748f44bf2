import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as PoliciesAPI from "../policies.js";
import { FallbackDomainsSinglePage } from "../policies.js";
export declare class FallbackDomains extends APIResource {
    /**
     * Sets the list of domains to bypass Gateway DNS resolution. These domains will
     * use the specified local DNS resolver instead. This will only apply to the
     * specified device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fallbackDomain of client.zeroTrust.devices.policies.custom.fallbackDomains.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     domains: [{ suffix: 'example.com' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(policyId: string, params: FallbackDomainUpdateParams, options?: Core.RequestOptions): Core.PagePromise<FallbackDomainsSinglePage, PoliciesAPI.FallbackDomain>;
    /**
     * Fetches the list of domains to bypass Gateway DNS resolution from a specified
     * device settings profile. These domains will use the specified local DNS resolver
     * instead.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fallbackDomain of client.zeroTrust.devices.policies.custom.fallbackDomains.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(policyId: string, params: FallbackDomainGetParams, options?: Core.RequestOptions): Core.PagePromise<FallbackDomainsSinglePage, PoliciesAPI.FallbackDomain>;
}
export interface FallbackDomainUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    domains: Array<PoliciesAPI.FallbackDomainParam>;
}
export interface FallbackDomainGetParams {
    account_id: string;
}
export declare namespace FallbackDomains {
    export { type FallbackDomainUpdateParams as FallbackDomainUpdateParams, type FallbackDomainGetParams as FallbackDomainGetParams, };
}
export { FallbackDomainsSinglePage };
//# sourceMappingURL=fallback-domains.d.ts.map