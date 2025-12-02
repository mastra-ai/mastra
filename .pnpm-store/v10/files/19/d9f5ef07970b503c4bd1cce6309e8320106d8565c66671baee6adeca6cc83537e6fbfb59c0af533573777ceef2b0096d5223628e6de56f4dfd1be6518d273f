import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as OperationsAPI from "./operations.js";
import { OperationBulkEditParams, OperationBulkEditResponse, OperationDeleteParams, OperationDeleteResponse, OperationGetParams, OperationGetResponse, OperationListParams, OperationListResponse, OperationListResponsesV4PagePaginationArray, OperationUpdateParams, OperationUpdateResponse, Operations } from "./operations.js";
export declare class Settings extends APIResource {
    operations: OperationsAPI.Operations;
    /**
     * Update global schema validation settings
     *
     * @example
     * ```ts
     * const setting =
     *   await client.schemaValidation.settings.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     validation_default_mitigation_action: 'block',
     *   });
     * ```
     */
    update(params: SettingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SettingUpdateResponse>;
    /**
     * Edit global schema validation settings
     *
     * @example
     * ```ts
     * const response =
     *   await client.schemaValidation.settings.edit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    edit(params: SettingEditParams, options?: Core.RequestOptions): Core.APIPromise<SettingEditResponse>;
    /**
     * Get global schema validation settings
     *
     * @example
     * ```ts
     * const setting = await client.schemaValidation.settings.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingGetResponse>;
}
export interface SettingUpdateResponse {
    /**
     * The default mitigation action used
     *
     * Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     * - `none` - skip running schema validation
     */
    validation_default_mitigation_action: 'none' | 'log' | 'block';
    /**
     * When not null, this overrides global both zone level and operation level
     * mitigation actions. This can serve as a quick way to disable schema validation
     * for the whole zone.
     *
     * - `"none"` will skip running schema validation entirely for the request
     */
    validation_override_mitigation_action?: 'none';
}
export interface SettingEditResponse {
    /**
     * The default mitigation action used
     *
     * Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     * - `none` - skip running schema validation
     */
    validation_default_mitigation_action: 'none' | 'log' | 'block';
    /**
     * When not null, this overrides global both zone level and operation level
     * mitigation actions. This can serve as a quick way to disable schema validation
     * for the whole zone.
     *
     * - `"none"` will skip running schema validation entirely for the request
     */
    validation_override_mitigation_action?: 'none';
}
export interface SettingGetResponse {
    /**
     * The default mitigation action used
     *
     * Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     * - `none` - skip running schema validation
     */
    validation_default_mitigation_action: 'none' | 'log' | 'block';
    /**
     * When not null, this overrides global both zone level and operation level
     * mitigation actions. This can serve as a quick way to disable schema validation
     * for the whole zone.
     *
     * - `"none"` will skip running schema validation entirely for the request
     */
    validation_override_mitigation_action?: 'none';
}
export interface SettingUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The default mitigation action used Mitigation actions are as
     * follows:
     *
     * - `"log"` - log request when request does not conform to schema
     * - `"block"` - deny access to the site when request does not conform to schema
     * - `"none"` - skip running schema validation
     */
    validation_default_mitigation_action: 'none' | 'log' | 'block';
    /**
     * Body param: When set, this overrides both zone level and operation level
     * mitigation actions.
     *
     * - `"none"` - skip running schema validation entirely for the request
     * - `null` - clears any existing override
     */
    validation_override_mitigation_action?: 'none' | null;
}
export interface SettingEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The default mitigation action used Mitigation actions are as
     * follows:
     *
     * - `"log"` - log request when request does not conform to schema
     * - `"block"` - deny access to the site when request does not conform to schema
     * - `"none"` - skip running schema validation
     */
    validation_default_mitigation_action?: 'none' | 'log' | 'block';
    /**
     * Body param: When set, this overrides both zone level and operation level
     * mitigation actions.
     *
     * - `"none"` - skip running schema validation entirely for the request
     * - `null` - clears any existing override
     */
    validation_override_mitigation_action?: 'none' | null;
}
export interface SettingGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Settings {
    export { type SettingUpdateResponse as SettingUpdateResponse, type SettingEditResponse as SettingEditResponse, type SettingGetResponse as SettingGetResponse, type SettingUpdateParams as SettingUpdateParams, type SettingEditParams as SettingEditParams, type SettingGetParams as SettingGetParams, };
    export { Operations as Operations, type OperationUpdateResponse as OperationUpdateResponse, type OperationListResponse as OperationListResponse, type OperationDeleteResponse as OperationDeleteResponse, type OperationBulkEditResponse as OperationBulkEditResponse, type OperationGetResponse as OperationGetResponse, OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray, type OperationUpdateParams as OperationUpdateParams, type OperationListParams as OperationListParams, type OperationDeleteParams as OperationDeleteParams, type OperationBulkEditParams as OperationBulkEditParams, type OperationGetParams as OperationGetParams, };
}
//# sourceMappingURL=settings.d.ts.map