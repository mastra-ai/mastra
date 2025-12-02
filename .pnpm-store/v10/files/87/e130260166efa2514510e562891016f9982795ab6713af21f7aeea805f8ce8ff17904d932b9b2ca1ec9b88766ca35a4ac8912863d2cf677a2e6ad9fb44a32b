import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class OwnershipResource extends APIResource {
    /**
     * Adds an AWS or GCP bucket to use with full packet captures.
     *
     * @example
     * ```ts
     * const ownership =
     *   await client.magicTransit.pcaps.ownership.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination_conf: 's3://pcaps-bucket?region=us-east-1',
     *   });
     * ```
     */
    create(params: OwnershipCreateParams, options?: Core.RequestOptions): Core.APIPromise<Ownership>;
    /**
     * Deletes buckets added to the packet captures API.
     *
     * @example
     * ```ts
     * await client.magicTransit.pcaps.ownership.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(ownershipId: string, params: OwnershipDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * List all buckets configured for use with PCAPs API.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ownership of client.magicTransit.pcaps.ownership.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params: OwnershipGetParams, options?: Core.RequestOptions): Core.PagePromise<OwnershipsSinglePage, Ownership>;
    /**
     * Validates buckets added to the packet captures API.
     *
     * @example
     * ```ts
     * const ownership =
     *   await client.magicTransit.pcaps.ownership.validate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination_conf: 's3://pcaps-bucket?region=us-east-1',
     *     ownership_challenge:
     *       'ownership-challenge-9883874ecac311ec8475433579a6bf5f.txt',
     *   });
     * ```
     */
    validate(params: OwnershipValidateParams, options?: Core.RequestOptions): Core.APIPromise<Ownership>;
}
export declare class OwnershipsSinglePage extends SinglePage<Ownership> {
}
export interface Ownership {
    /**
     * The bucket ID associated with the packet captures API.
     */
    id: string;
    /**
     * The full URI for the bucket. This field only applies to `full` packet captures.
     */
    destination_conf: string;
    /**
     * The ownership challenge filename stored in the bucket.
     */
    filename: string;
    /**
     * The status of the ownership challenge. Can be pending, success or failed.
     */
    status: 'pending' | 'success' | 'failed';
    /**
     * The RFC 3339 timestamp when the bucket was added to packet captures API.
     */
    submitted: string;
    /**
     * The RFC 3339 timestamp when the bucket was validated.
     */
    validated?: string;
}
export interface OwnershipCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The full URI for the bucket. This field only applies to `full`
     * packet captures.
     */
    destination_conf: string;
}
export interface OwnershipDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface OwnershipGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface OwnershipValidateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The full URI for the bucket. This field only applies to `full`
     * packet captures.
     */
    destination_conf: string;
    /**
     * Body param: The ownership challenge filename stored in the bucket.
     */
    ownership_challenge: string;
}
export declare namespace OwnershipResource {
    export { type Ownership as Ownership, OwnershipsSinglePage as OwnershipsSinglePage, type OwnershipCreateParams as OwnershipCreateParams, type OwnershipDeleteParams as OwnershipDeleteParams, type OwnershipGetParams as OwnershipGetParams, type OwnershipValidateParams as OwnershipValidateParams, };
}
//# sourceMappingURL=ownership.d.ts.map