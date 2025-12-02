import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as ConfigAPI from "../config.js";
import * as ConfigsAPI from "./configs.js";
import { ConfigGetParams, ConfigGetResponse, Configs } from "./configs.js";
import { SinglePage } from "../../../pagination.js";
export declare class History extends APIResource {
    configs: ConfigsAPI.Configs;
    /**
     * Restores a historical published Zaraz configuration by ID for a zone.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.history.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: 12345,
     * });
     * ```
     */
    update(params: HistoryUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ConfigAPI.Configuration>;
    /**
     * Lists a history of published Zaraz configuration records for a zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const historyListResponse of client.zaraz.history.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: HistoryListParams, options?: Core.RequestOptions): Core.PagePromise<HistoryListResponsesSinglePage, HistoryListResponse>;
}
export declare class HistoryListResponsesSinglePage extends SinglePage<HistoryListResponse> {
}
export interface HistoryListResponse {
    /**
     * ID of the configuration
     */
    id: number;
    /**
     * Date and time the configuration was created
     */
    createdAt: string;
    /**
     * Configuration description provided by the user who published this configuration
     */
    description: string;
    /**
     * Date and time the configuration was last updated
     */
    updatedAt: string;
    /**
     * Alpha-numeric ID of the account user who published the configuration
     */
    userId: string;
}
export interface HistoryUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: ID of the Zaraz configuration to restore.
     */
    body: number;
}
export interface HistoryListParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Maximum amount of results to list. Default value is 10.
     */
    limit?: number;
    /**
     * Query param: Ordinal number to start listing the results with. Default value
     * is 0.
     */
    offset?: number;
    /**
     * Query param: The field to sort by. Default is updated_at.
     */
    sortField?: 'id' | 'user_id' | 'description' | 'created_at' | 'updated_at';
    /**
     * Query param: Sorting order. Default is DESC.
     */
    sortOrder?: 'DESC' | 'ASC';
}
export declare namespace History {
    export { type HistoryListResponse as HistoryListResponse, HistoryListResponsesSinglePage as HistoryListResponsesSinglePage, type HistoryUpdateParams as HistoryUpdateParams, type HistoryListParams as HistoryListParams, };
    export { Configs as Configs, type ConfigGetResponse as ConfigGetResponse, type ConfigGetParams as ConfigGetParams, };
}
//# sourceMappingURL=history.d.ts.map