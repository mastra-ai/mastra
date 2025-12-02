// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { SplitTunnelExcludesSinglePage } from "../policies.mjs";
export class Excludes extends APIResource {
    /**
     * Sets the list of routes excluded from the WARP client's tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.default.excludes.update(
     *   {
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     body: [{ address: '192.0.2.0/24' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/exclude`, SplitTunnelExcludesSinglePage, { body: body, method: 'put', ...options });
    }
    /**
     * Fetches the list of routes excluded from the WARP client's tunnel.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const splitTunnelExclude of client.zeroTrust.devices.policies.default.excludes.get(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/exclude`, SplitTunnelExcludesSinglePage, options);
    }
}
export { SplitTunnelExcludesSinglePage };
//# sourceMappingURL=excludes.mjs.map