import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as DetectionsAPI from "./detections.js";
import { DetectionCreateParams, DetectionCreateResponse, DetectionDeleteParams, DetectionDeleteResponse, DetectionListParams, DetectionListResponse, DetectionListResponsesSinglePage, DetectionUpdateParams, DetectionUpdateResponse, Detections } from "./detections.js";
export declare class LeakedCredentialChecks extends APIResource {
    detections: DetectionsAPI.Detections;
    /**
     * Updates the current status of Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const leakedCredentialCheck =
     *   await client.leakedCredentialChecks.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params: LeakedCredentialCheckCreateParams, options?: Core.RequestOptions): Core.APIPromise<LeakedCredentialCheckCreateResponse>;
    /**
     * Retrieves the current status of Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const leakedCredentialCheck =
     *   await client.leakedCredentialChecks.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: LeakedCredentialCheckGetParams, options?: Core.RequestOptions): Core.APIPromise<LeakedCredentialCheckGetResponse>;
}
/**
 * Defines the overall status for Leaked Credential Checks.
 */
export interface LeakedCredentialCheckCreateResponse {
    /**
     * Determines whether or not Leaked Credential Checks are enabled.
     */
    enabled?: boolean;
}
/**
 * Defines the overall status for Leaked Credential Checks.
 */
export interface LeakedCredentialCheckGetResponse {
    /**
     * Determines whether or not Leaked Credential Checks are enabled.
     */
    enabled?: boolean;
}
export interface LeakedCredentialCheckCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: Determines whether or not Leaked Credential Checks are enabled.
     */
    enabled?: boolean;
}
export interface LeakedCredentialCheckGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace LeakedCredentialChecks {
    export { type LeakedCredentialCheckCreateResponse as LeakedCredentialCheckCreateResponse, type LeakedCredentialCheckGetResponse as LeakedCredentialCheckGetResponse, type LeakedCredentialCheckCreateParams as LeakedCredentialCheckCreateParams, type LeakedCredentialCheckGetParams as LeakedCredentialCheckGetParams, };
    export { Detections as Detections, type DetectionCreateResponse as DetectionCreateResponse, type DetectionUpdateResponse as DetectionUpdateResponse, type DetectionListResponse as DetectionListResponse, type DetectionDeleteResponse as DetectionDeleteResponse, DetectionListResponsesSinglePage as DetectionListResponsesSinglePage, type DetectionCreateParams as DetectionCreateParams, type DetectionUpdateParams as DetectionUpdateParams, type DetectionListParams as DetectionListParams, type DetectionDeleteParams as DetectionDeleteParams, };
}
//# sourceMappingURL=leaked-credential-checks.d.ts.map