import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as DiscoveryAPI from "./discovery.js";
import { DiscoveryOperationsV4PagePaginationArray } from "./discovery.js";
import { type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Operations extends APIResource {
    /**
     * Retrieve the most up to date view of discovered operations
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const discoveryOperation of client.apiGateway.discovery.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: OperationListParams, options?: Core.RequestOptions): Core.PagePromise<DiscoveryOperationsV4PagePaginationArray, DiscoveryAPI.DiscoveryOperation>;
    /**
     * Update the `state` on one or more discovered operations
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.discovery.operations.bulkEdit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {
     *       '3818d821-5901-4147-a474-f5f5aec1d54e': {},
     *       'b17c8043-99a0-4202-b7d9-8f7cdbee02cd': {},
     *     },
     *   });
     * ```
     */
    bulkEdit(params: OperationBulkEditParams, options?: Core.RequestOptions): Core.APIPromise<OperationBulkEditResponse>;
    /**
     * Update the `state` on a discovered operation
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.discovery.operations.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(operationId: string, params: OperationEditParams, options?: Core.RequestOptions): Core.APIPromise<OperationEditResponse>;
}
export type OperationBulkEditResponse = {
    [key: string]: OperationBulkEditResponse.item;
};
export declare namespace OperationBulkEditResponse {
    /**
     * Mappings of discovered operations (keys) to objects describing their state
     */
    interface item {
        /**
         * Mark state of operation in API Discovery
         *
         * - `review` - Mark operation as for review
         * - `ignored` - Mark operation as ignored
         */
        state?: 'review' | 'ignored';
    }
}
export interface OperationEditResponse {
    /**
     * State of operation in API Discovery
     *
     * - `review` - Operation is not saved into API Shield Endpoint Management
     * - `saved` - Operation is saved into API Shield Endpoint Management
     * - `ignored` - Operation is marked as ignored
     */
    state?: 'review' | 'saved' | 'ignored';
}
export interface OperationListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: When `true`, only return API Discovery results that are not saved
     * into API Shield Endpoint Management
     */
    diff?: boolean;
    /**
     * Query param: Direction to order results.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Filter results to only include endpoints containing this pattern.
     */
    endpoint?: string;
    /**
     * Query param: Filter results to only include the specified hosts.
     */
    host?: Array<string>;
    /**
     * Query param: Filter results to only include the specified HTTP methods.
     */
    method?: Array<string>;
    /**
     * Query param: Field to order by
     */
    order?: 'host' | 'method' | 'endpoint' | 'traffic_stats.requests' | 'traffic_stats.last_updated';
    /**
     * Query param: Filter results to only include discovery results sourced from a
     * particular discovery engine
     *
     * - `ML` - Discovered operations that were sourced using ML API Discovery
     * - `SessionIdentifier` - Discovered operations that were sourced using Session
     *   Identifier API Discovery
     */
    origin?: 'ML' | 'SessionIdentifier' | 'LabelDiscovery';
    /**
     * Query param: Filter results to only include discovery results in a particular
     * state. States are as follows
     *
     * - `review` - Discovered operations that are not saved into API Shield Endpoint
     *   Management
     * - `saved` - Discovered operations that are already saved into API Shield
     *   Endpoint Management
     * - `ignored` - Discovered operations that have been marked as ignored
     */
    state?: 'review' | 'saved' | 'ignored';
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
     * Mappings of discovered operations (keys) to objects describing their state
     */
    interface Body {
        /**
         * Mark state of operation in API Discovery
         *
         * - `review` - Mark operation as for review
         * - `ignored` - Mark operation as ignored
         */
        state?: 'review' | 'ignored';
    }
}
export interface OperationEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Mark state of operation in API Discovery
     *
     * - `review` - Mark operation as for review
     * - `ignored` - Mark operation as ignored
     */
    state?: 'review' | 'ignored';
}
export declare namespace Operations {
    export { type OperationBulkEditResponse as OperationBulkEditResponse, type OperationEditResponse as OperationEditResponse, type OperationListParams as OperationListParams, type OperationBulkEditParams as OperationBulkEditParams, type OperationEditParams as OperationEditParams, };
}
export { DiscoveryOperationsV4PagePaginationArray };
//# sourceMappingURL=operations.d.ts.map