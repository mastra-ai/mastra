// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as SchemaValidationAPI from './schema-validation';
import {
  SchemaValidation,
  SchemaValidationEditParams,
  SchemaValidationGetParams,
  SchemaValidationUpdateParams,
} from './schema-validation';

export class Settings extends APIResource {
  schemaValidation: SchemaValidationAPI.SchemaValidation = new SchemaValidationAPI.SchemaValidation(
    this._client,
  );
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

Settings.SchemaValidation = SchemaValidation;

export declare namespace Settings {
  export { type Settings as Settings };

  export {
    SchemaValidation as SchemaValidation,
    type SchemaValidationUpdateParams as SchemaValidationUpdateParams,
    type SchemaValidationEditParams as SchemaValidationEditParams,
    type SchemaValidationGetParams as SchemaValidationGetParams,
  };
}
