import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Token extends APIResource {
    /**
     * Gets the token used to associate warp device with a specific Warp Connector
     * tunnel.
     *
     * @example
     * ```ts
     * const token =
     *   await client.zeroTrust.tunnels.warpConnector.token.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId: string, params: TokenGetParams, options?: Core.RequestOptions): Core.APIPromise<TokenGetResponse>;
}
/**
 * The Tunnel Token is used as a mechanism to authenticate the operation of a
 * tunnel.
 */
export type TokenGetResponse = string;
export interface TokenGetParams {
    /**
     * Cloudflare account ID
     */
    account_id: string;
}
export declare namespace Token {
    export { type TokenGetResponse as TokenGetResponse, type TokenGetParams as TokenGetParams };
}
//# sourceMappingURL=token.d.ts.map