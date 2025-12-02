import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { SinglePage } from "../../pagination.js";
export declare class Rules extends APIResource {
    /**
     * Put Rules
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleUpdateResponse of client.snippets.rules.update(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params: RuleUpdateParams, options?: Core.RequestOptions): Core.PagePromise<RuleUpdateResponsesSinglePage, RuleUpdateResponse>;
    /**
     * Rules
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleListResponse of client.snippets.rules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<RuleListResponsesSinglePage, RuleListResponse>;
    /**
     * Delete All Rules
     *
     * @example
     * ```ts
     * const rule = await client.snippets.rules.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params: RuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RuleDeleteResponse>;
}
export declare class RuleUpdateResponsesSinglePage extends SinglePage<RuleUpdateResponse> {
}
export declare class RuleListResponsesSinglePage extends SinglePage<RuleListResponse> {
}
export interface RuleUpdateResponse {
    description?: string;
    enabled?: boolean;
    expression?: string;
    /**
     * Snippet identifying name
     */
    snippet_name?: string;
}
export interface RuleListResponse {
    description?: string;
    enabled?: boolean;
    expression?: string;
    /**
     * Snippet identifying name
     */
    snippet_name?: string;
}
export interface RuleDeleteResponse {
    errors: Array<Shared.ResponseInfo>;
    messages: Array<Shared.ResponseInfo>;
    /**
     * Whether the API call was successful
     */
    success: true;
}
export interface RuleUpdateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: List of snippet rules
     */
    rules?: Array<RuleUpdateParams.Rule>;
}
export declare namespace RuleUpdateParams {
    interface Rule {
        description?: string;
        enabled?: boolean;
        expression?: string;
        /**
         * Snippet identifying name
         */
        snippet_name?: string;
    }
}
export interface RuleListParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface RuleDeleteParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Rules {
    export { type RuleUpdateResponse as RuleUpdateResponse, type RuleListResponse as RuleListResponse, type RuleDeleteResponse as RuleDeleteResponse, RuleUpdateResponsesSinglePage as RuleUpdateResponsesSinglePage, RuleListResponsesSinglePage as RuleListResponsesSinglePage, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, };
}
//# sourceMappingURL=rules.d.ts.map