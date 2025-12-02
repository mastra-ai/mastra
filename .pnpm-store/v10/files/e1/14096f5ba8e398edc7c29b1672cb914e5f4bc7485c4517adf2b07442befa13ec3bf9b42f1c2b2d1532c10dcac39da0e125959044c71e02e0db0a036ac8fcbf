// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Settings extends APIResource {
  /**
   * Retrieve the current status of Content Scanning.
   */
  get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<SettingGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/content-upload-scan/settings`, options) as Core.APIPromise<{
        result: SettingGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Defines the status for Content Scanning.
 */
export interface SettingGetResponse {
  /**
   * Defines the last modification date (ISO 8601) of the Content Scanning status.
   */
  modified?: string;

  /**
   * Defines the status of Content Scanning.
   */
  value?: string;
}

export interface SettingGetParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export declare namespace Settings {
  export { type SettingGetResponse as SettingGetResponse, type SettingGetParams as SettingGetParams };
}
