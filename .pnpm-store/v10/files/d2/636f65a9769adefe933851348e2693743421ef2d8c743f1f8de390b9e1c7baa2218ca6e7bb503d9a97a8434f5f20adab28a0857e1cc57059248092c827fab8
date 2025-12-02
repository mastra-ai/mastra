// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class GlobalWARPOverride extends APIResource {
    /**
     * Sets the Global WARP override state.
     *
     * @example
     * ```ts
     * const globalWARPOverride =
     *   await client.zeroTrust.devices.resilience.globalWARPOverride.create(
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       disconnect: false,
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/resilience/disconnect`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch the Global WARP override state.
     *
     * @example
     * ```ts
     * const globalWARPOverride =
     *   await client.zeroTrust.devices.resilience.globalWARPOverride.get(
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/resilience/disconnect`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=global-warp-override.mjs.map