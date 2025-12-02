import { APIResource } from "../../../resource.js";
import * as SchemaValidationAPI from "./schema-validation.js";
import { SchemaValidation, SchemaValidationEditParams, SchemaValidationGetParams, SchemaValidationUpdateParams } from "./schema-validation.js";
export declare class Settings extends APIResource {
    schemaValidation: SchemaValidationAPI.SchemaValidation;
}
export interface Settings {
    /**
     * The default mitigation action used when there is no mitigation action defined on
     * the operation
     *
     * Mitigation actions are as follows:
     *
     * - `log` - log request when request does not conform to schema
     * - `block` - deny access to the site when request does not conform to schema
     *
     * A special value of of `none` will skip running schema validation entirely for
     * the request when there is no mitigation action defined on the operation
     */
    validation_default_mitigation_action?: 'none' | 'log' | 'block';
    /**
     * When set, this overrides both zone level and operation level mitigation actions.
     *
     * - `none` will skip running schema validation entirely for the request
     * - `null` indicates that no override is in place
     */
    validation_override_mitigation_action?: 'none' | null;
}
export declare namespace Settings {
    export { type Settings as Settings };
    export { SchemaValidation as SchemaValidation, type SchemaValidationUpdateParams as SchemaValidationUpdateParams, type SchemaValidationEditParams as SchemaValidationEditParams, type SchemaValidationGetParams as SchemaValidationGetParams, };
}
//# sourceMappingURL=settings.d.ts.map