import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Detections extends APIResource {
    /**
     * Create user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params: DetectionCreateParams, options?: Core.RequestOptions): Core.APIPromise<DetectionCreateResponse>;
    /**
     * Update user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.update(
     *     '18a14bafaa8eb1df04ce683ec18c765e',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(detectionId: string, params: DetectionUpdateParams, options?: Core.RequestOptions): Core.APIPromise<DetectionUpdateResponse>;
    /**
     * List user-defined detection patterns for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const detectionListResponse of client.leakedCredentialChecks.detections.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: DetectionListParams, options?: Core.RequestOptions): Core.PagePromise<DetectionListResponsesSinglePage, DetectionListResponse>;
    /**
     * Remove user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.delete(
     *     '18a14bafaa8eb1df04ce683ec18c765e',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(detectionId: string, params: DetectionDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DetectionDeleteResponse>;
}
export declare class DetectionListResponsesSinglePage extends SinglePage<DetectionListResponse> {
}
/**
 * Defines a custom set of username/password expressions to match Leaked Credential
 * Checks on.
 */
export interface DetectionCreateResponse {
    /**
     * Defines the unique ID for this custom detection.
     */
    id?: string;
    /**
     * Defines ehe ruleset expression to use in matching the password in a request.
     */
    password?: string;
    /**
     * Defines the ruleset expression to use in matching the username in a request.
     */
    username?: string;
}
/**
 * Defines a custom set of username/password expressions to match Leaked Credential
 * Checks on.
 */
export interface DetectionUpdateResponse {
    /**
     * Defines the unique ID for this custom detection.
     */
    id?: string;
    /**
     * Defines ehe ruleset expression to use in matching the password in a request.
     */
    password?: string;
    /**
     * Defines the ruleset expression to use in matching the username in a request.
     */
    username?: string;
}
/**
 * Defines a custom set of username/password expressions to match Leaked Credential
 * Checks on.
 */
export interface DetectionListResponse {
    /**
     * Defines the unique ID for this custom detection.
     */
    id?: string;
    /**
     * Defines ehe ruleset expression to use in matching the password in a request.
     */
    password?: string;
    /**
     * Defines the ruleset expression to use in matching the username in a request.
     */
    username?: string;
}
export type DetectionDeleteResponse = unknown;
export interface DetectionCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: Defines ehe ruleset expression to use in matching the password in a
     * request.
     */
    password?: string;
    /**
     * Body param: Defines the ruleset expression to use in matching the username in a
     * request.
     */
    username?: string;
}
export interface DetectionUpdateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: Defines ehe ruleset expression to use in matching the password in a
     * request.
     */
    password?: string;
    /**
     * Body param: Defines the ruleset expression to use in matching the username in a
     * request.
     */
    username?: string;
}
export interface DetectionListParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface DetectionDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace Detections {
    export { type DetectionCreateResponse as DetectionCreateResponse, type DetectionUpdateResponse as DetectionUpdateResponse, type DetectionListResponse as DetectionListResponse, type DetectionDeleteResponse as DetectionDeleteResponse, DetectionListResponsesSinglePage as DetectionListResponsesSinglePage, type DetectionCreateParams as DetectionCreateParams, type DetectionUpdateParams as DetectionUpdateParams, type DetectionListParams as DetectionListParams, type DetectionDeleteParams as DetectionDeleteParams, };
}
//# sourceMappingURL=detections.d.ts.map