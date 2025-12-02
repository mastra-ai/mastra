// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { SplitTunnelIncludesSinglePage } from "../policies.mjs";
export class Includes extends APIResource {
    /**
     * Sets the list of routes included in the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.custom.includes.update(
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
    update(policyId, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}/include`, SplitTunnelIncludesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Fetches the list of routes included in the WARP client's tunnel for a specific
     * device settings profile.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelInclude of client.zeroTrust.devices.policies.custom.includes.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}/include`, SplitTunnelIncludesSinglePage, options);
    }
}
export { SplitTunnelIncludesSinglePage };
//# sourceMappingURL=includes.mjs.map