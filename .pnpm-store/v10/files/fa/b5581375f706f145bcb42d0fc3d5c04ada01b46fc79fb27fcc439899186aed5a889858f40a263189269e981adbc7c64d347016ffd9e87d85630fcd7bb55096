import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Fallthrough extends APIResource {
    /**
     * Generate fallthrough WAF expression template from a set of API hosts
     *
     * @example
     * ```ts
     * const fallthrough =
     *   await client.apiGateway.expressionTemplate.fallthrough.create(
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hosts: ['{zone}.domain1.tld', 'domain2.tld'],
     *     },
     *   );
     * ```
     */
    create(params: FallthroughCreateParams, options?: Core.RequestOptions): Core.APIPromise<FallthroughCreateResponse>;
}
export interface FallthroughCreateResponse {
    /**
     * WAF Expression for fallthrough
     */
    expression: string;
    /**
     * Title for the expression
     */
    title: string;
}
export interface FallthroughCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: List of hosts to be targeted in the expression
     */
    hosts: Array<string>;
}
export declare namespace Fallthrough {
    export { type FallthroughCreateResponse as FallthroughCreateResponse, type FallthroughCreateParams as FallthroughCreateParams, };
}
//# sourceMappingURL=fallthrough.d.ts.map