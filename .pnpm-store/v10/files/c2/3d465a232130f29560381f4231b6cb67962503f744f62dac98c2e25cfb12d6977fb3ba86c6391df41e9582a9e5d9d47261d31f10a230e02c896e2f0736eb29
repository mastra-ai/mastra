import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SettingsAPI from "./settings.js";
export declare class SchemaValidation extends APIResource {
    /**
     * Updates zone level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    update(params: SchemaValidationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SettingsAPI.Settings>;
    /**
     * Updates zone level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    edit(params: SchemaValidationEditParams, options?: Core.RequestOptions): Core.APIPromise<SettingsAPI.Settings>;
    /**
     * Retrieves zone level schema validation settings currently set on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    get(params: SchemaValidationGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingsAPI.Settings>;
}
export interface SchemaValidationUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The default mitigation action used when there is no mitigation
     * action defined on the operation
     *
     * Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     *
     * A special value of of `none` will skip running schema validation entirely for
     * the request when there is no mitigation action defined on the operation
     */
    validation_default_mitigation_action: 'none' | 'log' | 'block';
    /**
     * Body param: When set, this overrides both zone level and operation level
     * mitigation actions.
     *
     * - `none` will skip running schema validation entirely for the request
     * - `null` indicates that no override is in place
     *
     * To clear any override, use the special value `disable_override` or `null`
     */
    validation_override_mitigation_action?: 'none' | 'disable_override' | null;
}
export interface SchemaValidationEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The default mitigation action used when there is no mitigation
     * action defined on the operation Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     *
     * A special value of of `none` will skip running schema validation entirely for
     * the request when there is no mitigation action defined on the operation
     *
     * `null` will have no effect.
     */
    validation_default_mitigation_action?: 'none' | 'log' | 'block' | null;
    /**
     * Body param: When set, this overrides both zone level and operation level
     * mitigation actions.
     *
     * - `none` will skip running schema validation entirely for the request
     *
     * To clear any override, use the special value `disable_override`
     *
     * `null` will have no effect.
     */
    validation_override_mitigation_action?: 'none' | 'disable_override' | null;
}
export interface SchemaValidationGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace SchemaValidation {
    export { type SchemaValidationUpdateParams as SchemaValidationUpdateParams, type SchemaValidationEditParams as SchemaValidationEditParams, type SchemaValidationGetParams as SchemaValidationGetParams, };
}
//# sourceMappingURL=schema-validation.d.ts.map