import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Tokens extends APIResource {
    /**
     * Generate authentication token for VPC flow logs export.
     *
     * @example
     * ```ts
     * const token =
     *   await client.magicNetworkMonitoring.vpcFlows.tokens.create(
     *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
     *   );
     * ```
     */
    create(params: TokenCreateParams, options?: Core.RequestOptions): Core.APIPromise<TokenCreateResponse>;
}
/**
 * Authentication token to be used for VPC Flows export authentication.
 */
export type TokenCreateResponse = string;
export interface TokenCreateParams {
    account_id: string;
}
export declare namespace Tokens {
    export { type TokenCreateResponse as TokenCreateResponse, type TokenCreateParams as TokenCreateParams };
}
//# sourceMappingURL=tokens.d.ts.map