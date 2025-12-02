import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Operations extends APIResource {
    /**
     * Update per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       mitigation_action: 'block',
     *     },
     *   );
     * ```
     */
    update(operationId: string, params: OperationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<OperationUpdateResponse>;
    /**
     * List per-operation schema validation settings
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationListResponse of client.schemaValidation.settings.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: OperationListParams, options?: Core.RequestOptions): Core.PagePromise<OperationListResponsesV4PagePaginationArray, OperationListResponse>;
    /**
     * Delete per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(operationId: string, params: OperationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<OperationDeleteResponse>;
    /**
     * Bulk edit per-operation schema validation settings
     *
     * @example
     * ```ts
     * const response =
     *   await client.schemaValidation.settings.operations.bulkEdit(
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: {
     *         '3818d821-5901-4147-a474-f5f5aec1d54e': {},
     *         'b17c8043-99a0-4202-b7d9-8f7cdbee02cd': {},
     *       },
     *     },
     *   );
     * ```
     */
    bulkEdit(params: OperationBulkEditParams, options?: Core.RequestOptions): Core.APIPromise<OperationBulkEditResponse>;
    /**
     * Get per-operation schema validation setting
     *
     * @example
     * ```ts
     * const operation =
     *   await client.schemaValidation.settings.operations.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(operationId: string, params: OperationGetParams, options?: Core.RequestOptions): Core.APIPromise<OperationGetResponse>;
}
export declare class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray<OperationListResponse> {
}
export interface OperationUpdateResponse {
    /**
     * When set, this applies a mitigation action to this operation which supersedes a
     * global schema validation setting just for this operation
     *
     * - `"log"` - log request when request does not conform to schema for this
     *   operation
     * - `"block"` - deny access to the site when request does not conform to schema
     *   for this operation
     * - `"none"` - will skip mitigation for this operation
     */
    mitigation_action: 'log' | 'block' | 'none';
    /**
     * UUID.
     */
    operation_id: string;
}
export interface OperationListResponse {
    /**
     * When set, this applies a mitigation action to this operation which supersedes a
     * global schema validation setting just for this operation
     *
     * - `"log"` - log request when request does not conform to schema for this
     *   operation
     * - `"block"` - deny access to the site when request does not conform to schema
     *   for this operation
     * - `"none"` - will skip mitigation for this operation
     */
    mitigation_action: 'log' | 'block' | 'none';
    /**
     * UUID.
     */
    operation_id: string;
}
export interface OperationDeleteResponse {
    /**
     * UUID.
     */
    operation_id?: string;
}
/**
 * Operation ID to per operation setting mapping
 */
export type OperationBulkEditResponse = {
    [key: string]: OperationBulkEditResponse.item;
};
export declare namespace OperationBulkEditResponse {
    interface item {
        /**
         * When set, this applies a mitigation action to this operation which supersedes a
         * global schema validation setting just for this operation
         *
         * - `"log"` - log request when request does not conform to schema for this
         *   operation
         * - `"block"` - deny access to the site when request does not conform to schema
         *   for this operation
         * - `"none"` - will skip mitigation for this operation
         */
        mitigation_action: 'log' | 'block' | 'none';
        /**
         * UUID.
         */
        operation_id: string;
    }
}
export interface OperationGetResponse {
    /**
     * When set, this applies a mitigation action to this operation which supersedes a
     * global schema validation setting just for this operation
     *
     * - `"log"` - log request when request does not conform to schema for this
     *   operation
     * - `"block"` - deny access to the site when request does not conform to schema
     *   for this operation
     * - `"none"` - will skip mitigation for this operation
     */
    mitigation_action: 'log' | 'block' | 'none';
    /**
     * UUID.
     */
    operation_id: string;
}
export interface OperationUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: When set, this applies a mitigation action to this operation
     *
     * - `"log"` - log request when request does not conform to schema for this
     *   operation
     * - `"block"` - deny access to the site when request does not conform to schema
     *   for this operation
     * - `"none"` - will skip mitigation for this operation
     * - `null` - clears any mitigation action
     */
    mitigation_action: 'log' | 'block' | 'none' | null;
}
export interface OperationListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
}
export interface OperationDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface OperationBulkEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: {
        [key: string]: OperationBulkEditParams.Body;
    };
}
export declare namespace OperationBulkEditParams {
    /**
     * Operation ID to mitigation action mappings
     */
    interface Body {
        /**
         * Mitigation actions are as follows:
         *
         * - `log` - log request when request does not conform to schema _ `block` - deny
         *   access to the site when request does not conform to schema _ `none` - skip
         *   running schema validation \* null - clears any existing per-operation setting
         */
        mitigation_action?: 'none' | 'log' | 'block' | null;
    }
}
export interface OperationGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Operations {
    export { type OperationUpdateResponse as OperationUpdateResponse, type OperationListResponse as OperationListResponse, type OperationDeleteResponse as OperationDeleteResponse, type OperationBulkEditResponse as OperationBulkEditResponse, type OperationGetResponse as OperationGetResponse, OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray, type OperationUpdateParams as OperationUpdateParams, type OperationListParams as OperationListParams, type OperationDeleteParams as OperationDeleteParams, type OperationBulkEditParams as OperationBulkEditParams, type OperationGetParams as OperationGetParams, };
}
//# sourceMappingURL=operations.d.ts.map