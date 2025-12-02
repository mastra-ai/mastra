import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Management extends APIResource {
    /**
     * Gets a management token used to access the management resources (i.e. Streaming
     * Logs) of a tunnel.
     *
     * @example
     * ```ts
     * const management =
     *   await client.zeroTrust.tunnels.cloudflared.management.create(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       resources: ['logs'],
     *     },
     *   );
     * ```
     */
    create(tunnelId: string, params: ManagementCreateParams, options?: Core.RequestOptions): Core.APIPromise<ManagementCreateResponse>;
}
/**
 * The Tunnel Token is used as a mechanism to authenticate the operation of a
 * tunnel.
 */
export type ManagementCreateResponse = string;
export interface ManagementCreateParams {
    /**
     * Path param: Cloudflare account ID
     */
    account_id: string;
    /**
     * Body param:
     */
    resources: Array<'logs'>;
}
export declare namespace Management {
    export { type ManagementCreateResponse as ManagementCreateResponse, type ManagementCreateParams as ManagementCreateParams, };
}
//# sourceMappingURL=management.d.ts.map