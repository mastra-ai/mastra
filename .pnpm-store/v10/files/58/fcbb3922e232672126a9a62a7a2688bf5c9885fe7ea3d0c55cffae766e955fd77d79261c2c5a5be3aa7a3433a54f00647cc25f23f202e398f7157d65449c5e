import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Retention extends APIResource {
    /**
     * Updates log retention flag for Logpull API.
     *
     * @example
     * ```ts
     * const retention =
     *   await client.logs.control.retention.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params: RetentionCreateParams, options?: Core.RequestOptions): Core.APIPromise<RetentionCreateResponse | null>;
    /**
     * Gets log retention flag for Logpull API.
     *
     * @example
     * ```ts
     * const retention = await client.logs.control.retention.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: RetentionGetParams, options?: Core.RequestOptions): Core.APIPromise<RetentionGetResponse | null>;
}
export interface RetentionCreateResponse {
    /**
     * The log retention flag for Logpull API.
     */
    flag?: boolean;
}
export interface RetentionGetResponse {
    /**
     * The log retention flag for Logpull API.
     */
    flag?: boolean;
}
export interface RetentionCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The log retention flag for Logpull API.
     */
    flag?: boolean;
}
export interface RetentionGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Retention {
    export { type RetentionCreateResponse as RetentionCreateResponse, type RetentionGetResponse as RetentionGetResponse, type RetentionCreateParams as RetentionCreateParams, type RetentionGetParams as RetentionGetParams, };
}
//# sourceMappingURL=retention.d.ts.map