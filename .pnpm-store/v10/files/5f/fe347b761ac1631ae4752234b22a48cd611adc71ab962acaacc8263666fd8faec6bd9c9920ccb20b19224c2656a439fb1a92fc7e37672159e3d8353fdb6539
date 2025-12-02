import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Validate extends APIResource {
    /**
     * Validates destination.
     *
     * @example
     * ```ts
     * const response = await client.logpush.validate.destination({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     * });
     * ```
     */
    destination(params: ValidateDestinationParams, options?: Core.RequestOptions): Core.APIPromise<ValidateDestinationResponse | null>;
    /**
     * Checks if there is an existing job with a destination.
     *
     * @example
     * ```ts
     * const response =
     *   await client.logpush.validate.destinationExists({
     *     destination_conf: 's3://mybucket/logs?region=us-west-2',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    destinationExists(params: ValidateDestinationExistsParams, options?: Core.RequestOptions): Core.APIPromise<ValidateDestinationExistsResponse | null>;
    /**
     * Validates logpull origin with logpull_options.
     *
     * @example
     * ```ts
     * const response = await client.logpush.validate.origin({
     *   logpull_options:
     *     'fields=RayID,ClientIP,EdgeStartTimestamp&timestamps=rfc3339',
     *   account_id: 'account_id',
     * });
     * ```
     */
    origin(params: ValidateOriginParams, options?: Core.RequestOptions): Core.APIPromise<ValidateOriginResponse | null>;
}
export interface ValidateDestinationResponse {
    message?: string;
    valid?: boolean;
}
export interface ValidateDestinationExistsResponse {
    exists?: boolean;
}
export interface ValidateOriginResponse {
    message?: string;
    valid?: boolean;
}
export interface ValidateDestinationParams {
    /**
     * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
     * will be pushed. Additional configuration parameters supported by the destination
     * may be included.
     */
    destination_conf: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
}
export interface ValidateDestinationExistsParams {
    /**
     * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
     * will be pushed. Additional configuration parameters supported by the destination
     * may be included.
     */
    destination_conf: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
}
export interface ValidateOriginParams {
    /**
     * @deprecated Body param: This field is deprecated. Use `output_options` instead.
     * Configuration string. It specifies things like requested fields and timestamp
     * formats. If migrating from the logpull api, copy the url (full url or just the
     * query string) of your call here, and logpush will keep on making this call for
     * you, setting start and end times appropriately.
     */
    logpull_options: string | null;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
}
export declare namespace Validate {
    export { type ValidateDestinationResponse as ValidateDestinationResponse, type ValidateDestinationExistsResponse as ValidateDestinationExistsResponse, type ValidateOriginResponse as ValidateOriginResponse, type ValidateDestinationParams as ValidateDestinationParams, type ValidateDestinationExistsParams as ValidateDestinationExistsParams, type ValidateOriginParams as ValidateOriginParams, };
}
//# sourceMappingURL=validate.d.ts.map