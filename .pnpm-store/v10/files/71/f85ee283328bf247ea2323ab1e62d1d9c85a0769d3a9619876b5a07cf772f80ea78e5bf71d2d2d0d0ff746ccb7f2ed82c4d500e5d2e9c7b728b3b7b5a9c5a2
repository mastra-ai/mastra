import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Ownership extends APIResource {
    /**
     * Gets a new ownership challenge sent to your destination.
     *
     * @example
     * ```ts
     * const ownership = await client.logpush.ownership.create({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     * });
     * ```
     */
    create(params: OwnershipCreateParams, options?: Core.RequestOptions): Core.APIPromise<OwnershipCreateResponse | null>;
    /**
     * Validates ownership challenge of the destination.
     *
     * @example
     * ```ts
     * const ownershipValidation =
     *   await client.logpush.ownership.validate({
     *     destination_conf: 's3://mybucket/logs?region=us-west-2',
     *     ownership_challenge: '00000000000000000000',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    validate(params: OwnershipValidateParams, options?: Core.RequestOptions): Core.APIPromise<OwnershipValidation | null>;
}
export interface OwnershipValidation {
    valid?: boolean;
}
export interface OwnershipCreateResponse {
    filename?: string;
    message?: string;
    valid?: boolean;
}
export interface OwnershipCreateParams {
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
export interface OwnershipValidateParams {
    /**
     * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
     * will be pushed. Additional configuration parameters supported by the destination
     * may be included.
     */
    destination_conf: string;
    /**
     * Body param: Ownership challenge token to prove destination ownership.
     */
    ownership_challenge: string;
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
export declare namespace Ownership {
    export { type OwnershipValidation as OwnershipValidation, type OwnershipCreateResponse as OwnershipCreateResponse, type OwnershipCreateParams as OwnershipCreateParams, type OwnershipValidateParams as OwnershipValidateParams, };
}
//# sourceMappingURL=ownership.d.ts.map