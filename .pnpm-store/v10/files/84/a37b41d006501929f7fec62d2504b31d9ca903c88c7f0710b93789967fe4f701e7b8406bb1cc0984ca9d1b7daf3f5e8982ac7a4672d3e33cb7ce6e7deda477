import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Payloads extends APIResource {
    /**
     * Add custom scan expressions for Content Scanning.
     */
    create(params: PayloadCreateParams, options?: Core.RequestOptions): Core.PagePromise<PayloadCreateResponsesSinglePage, PayloadCreateResponse>;
    /**
     * Get a list of existing custom scan expressions for Content Scanning.
     */
    list(params: PayloadListParams, options?: Core.RequestOptions): Core.PagePromise<PayloadListResponsesSinglePage, PayloadListResponse>;
    /**
     * Delete a Content Scan Custom Expression.
     */
    delete(expressionId: string, params: PayloadDeleteParams, options?: Core.RequestOptions): Core.PagePromise<PayloadDeleteResponsesSinglePage, PayloadDeleteResponse>;
}
export declare class PayloadCreateResponsesSinglePage extends SinglePage<PayloadCreateResponse> {
}
export declare class PayloadListResponsesSinglePage extends SinglePage<PayloadListResponse> {
}
export declare class PayloadDeleteResponsesSinglePage extends SinglePage<PayloadDeleteResponse> {
}
/**
 * Defines a custom scan expression to match Content Scanning on.
 */
export interface PayloadCreateResponse {
    /**
     * defines the unique ID for this custom scan expression.
     */
    id?: string;
    /**
     * Defines the ruleset expression to use in matching content objects.
     */
    payload?: string;
}
/**
 * Defines a custom scan expression to match Content Scanning on.
 */
export interface PayloadListResponse {
    /**
     * defines the unique ID for this custom scan expression.
     */
    id?: string;
    /**
     * Defines the ruleset expression to use in matching content objects.
     */
    payload?: string;
}
/**
 * Defines a custom scan expression to match Content Scanning on.
 */
export interface PayloadDeleteResponse {
    /**
     * defines the unique ID for this custom scan expression.
     */
    id?: string;
    /**
     * Defines the ruleset expression to use in matching content objects.
     */
    payload?: string;
}
export interface PayloadCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: Array<PayloadCreateParams.Body>;
}
export declare namespace PayloadCreateParams {
    interface Body {
        /**
         * Defines the ruleset expression to use in matching content objects.
         */
        payload: string;
    }
}
export interface PayloadListParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface PayloadDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Payloads {
    export { type PayloadCreateResponse as PayloadCreateResponse, type PayloadListResponse as PayloadListResponse, type PayloadDeleteResponse as PayloadDeleteResponse, PayloadCreateResponsesSinglePage as PayloadCreateResponsesSinglePage, PayloadListResponsesSinglePage as PayloadListResponsesSinglePage, PayloadDeleteResponsesSinglePage as PayloadDeleteResponsesSinglePage, type PayloadCreateParams as PayloadCreateParams, type PayloadListParams as PayloadListParams, type PayloadDeleteParams as PayloadDeleteParams, };
}
//# sourceMappingURL=payloads.d.ts.map