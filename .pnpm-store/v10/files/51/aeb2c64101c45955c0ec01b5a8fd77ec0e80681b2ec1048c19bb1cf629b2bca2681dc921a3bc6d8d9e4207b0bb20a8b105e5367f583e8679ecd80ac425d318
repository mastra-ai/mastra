import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class GlobalWARPOverride extends APIResource {
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
    create(params: GlobalWARPOverrideCreateParams, options?: Core.RequestOptions): Core.APIPromise<GlobalWARPOverrideCreateResponse | null>;
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
    get(params: GlobalWARPOverrideGetParams, options?: Core.RequestOptions): Core.APIPromise<GlobalWARPOverrideGetResponse | null>;
}
export interface GlobalWARPOverrideCreateResponse {
    /**
     * Disconnects all devices on the account using Global WARP override.
     */
    disconnect?: boolean;
    /**
     * When the Global WARP override state was updated.
     */
    timestamp?: string;
}
export interface GlobalWARPOverrideGetResponse {
    /**
     * Disconnects all devices on the account using Global WARP override.
     */
    disconnect?: boolean;
    /**
     * When the Global WARP override state was updated.
     */
    timestamp?: string;
}
export interface GlobalWARPOverrideCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Disconnects all devices on the account using Global WARP override.
     */
    disconnect: boolean;
    /**
     * Body param: Reasoning for setting the Global WARP override state. This will be
     * surfaced in the audit log.
     */
    justification?: string;
}
export interface GlobalWARPOverrideGetParams {
    account_id: string;
}
export declare namespace GlobalWARPOverride {
    export { type GlobalWARPOverrideCreateResponse as GlobalWARPOverrideCreateResponse, type GlobalWARPOverrideGetResponse as GlobalWARPOverrideGetResponse, type GlobalWARPOverrideCreateParams as GlobalWARPOverrideCreateParams, type GlobalWARPOverrideGetParams as GlobalWARPOverrideGetParams, };
}
//# sourceMappingURL=global-warp-override.d.ts.map