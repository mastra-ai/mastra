import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as PoliciesAPI from "../policies.js";
import { SplitTunnelExcludesSinglePage } from "../policies.js";
export declare class Excludes extends APIResource {
    /**
     * Sets the list of routes excluded from the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.custom.excludes.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     body: [{ address: '192.0.2.0/24' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(policyId: string, params: ExcludeUpdateParams, options?: Core.RequestOptions): Core.PagePromise<SplitTunnelExcludesSinglePage, PoliciesAPI.SplitTunnelExclude>;
    /**
     * Fetches the list of routes excluded from the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.custom.excludes.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(policyId: string, params: ExcludeGetParams, options?: Core.RequestOptions): Core.PagePromise<SplitTunnelExcludesSinglePage, PoliciesAPI.SplitTunnelExclude>;
}
export interface ExcludeUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<PoliciesAPI.SplitTunnelExcludeParam>;
}
export interface ExcludeGetParams {
    account_id: string;
}
export declare namespace Excludes {
    export { type ExcludeUpdateParams as ExcludeUpdateParams, type ExcludeGetParams as ExcludeGetParams };
}
export { SplitTunnelExcludesSinglePage };
//# sourceMappingURL=excludes.d.ts.map