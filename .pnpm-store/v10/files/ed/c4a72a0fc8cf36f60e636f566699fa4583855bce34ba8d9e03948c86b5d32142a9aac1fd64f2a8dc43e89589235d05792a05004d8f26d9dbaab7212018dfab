// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SettingsAPI from './settings';

export class SchemaValidation extends APIResource {
  /**
   * Updates zone level schema validation settings on the zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  update(
    params: SchemaValidationUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SettingsAPI.Settings> {
    const { zone_id, ...body } = params;
    return this._client.put(`/zones/${zone_id}/api_gateway/settings/schema_validation`, { body, ...options });
  }

  /**
   * Updates zone level schema validation settings on the zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  edit(
    params: SchemaValidationEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SettingsAPI.Settings> {
    const { zone_id, ...body } = params;
    return this._client.patch(`/zones/${zone_id}/api_gateway/settings/schema_validation`, {
      body,
      ...options,
    });
  }

  /**
   * Retrieves zone level schema validation settings currently set on the zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  get(
    params: SchemaValidationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SettingsAPI.Settings> {
    const { zone_id } = params;
    return this._client.get(`/zones/${zone_id}/api_gateway/settings/schema_validation`, options);
  }
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
  export {
    type SchemaValidationUpdateParams as SchemaValidationUpdateParams,
    type SchemaValidationEditParams as SchemaValidationEditParams,
    type SchemaValidationGetParams as SchemaValidationGetParams,
  };
}
