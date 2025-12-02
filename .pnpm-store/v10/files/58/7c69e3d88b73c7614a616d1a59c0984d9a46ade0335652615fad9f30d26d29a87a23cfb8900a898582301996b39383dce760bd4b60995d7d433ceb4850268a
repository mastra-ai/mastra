import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class BulkOperations extends APIResource {
    /**
     * Gets the current status of an asynchronous operation on a list.
     *
     * The `status` property can have one of the following values: `pending`,
     * `running`, `completed`, or `failed`. If the status is `failed`, the `error`
     * property will contain a message describing the error.
     *
     * @example
     * ```ts
     * const bulkOperation =
     *   await client.rules.lists.bulkOperations.get(
     *     '4da8780eeb215e6cb7f48dd981c4ea02',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(operationId: string, params: BulkOperationGetParams, options?: Core.RequestOptions): Core.APIPromise<BulkOperationGetResponse>;
}
export interface BulkOperationGetResponse {
    /**
     * The unique operation ID of the asynchronous action.
     */
    id: string;
    /**
     * The current status of the asynchronous operation.
     */
    status: 'pending' | 'running' | 'completed' | 'failed';
    /**
     * The RFC 3339 timestamp of when the operation was completed.
     */
    completed?: string;
    /**
     * A message describing the error when the status is `failed`.
     */
    error?: string;
}
export interface BulkOperationGetParams {
    /**
     * Defines an identifier.
     */
    account_id: string;
}
export declare namespace BulkOperations {
    export { type BulkOperationGetResponse as BulkOperationGetResponse, type BulkOperationGetParams as BulkOperationGetParams, };
}
//# sourceMappingURL=bulk-operations.d.ts.map