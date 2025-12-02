// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ConfigAPI from '../config';

export class Configs extends APIResource {
  /**
   * Gets a history of published Zaraz configurations by ID(s) for a zone.
   *
   * @example
   * ```ts
   * const config = await client.zaraz.history.configs.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   ids: [0],
   * });
   * ```
   */
  get(params: ConfigGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigGetResponse> {
    const { zone_id, ...query } = params;
    return (
      this._client.get(`/zones/${zone_id}/settings/zaraz/history/configs`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ConfigGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Object where keys are numericc onfiguration IDs
 */
export type ConfigGetResponse = { [key: string]: ConfigGetResponse.item };

export namespace ConfigGetResponse {
  export interface item {
    /**
     * ID of the configuration
     */
    id: number;

    /**
     * Zaraz configuration
     */
    config: ConfigAPI.Configuration;

    /**
     * Date and time the configuration was created
     */
    createdAt: string;

    /**
     * Date and time the configuration was last updated
     */
    updatedAt: string;

    /**
     * Alpha-numeric ID of the account user who published the configuration
     */
    userId: string;
  }
}

export interface ConfigGetParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: Comma separated list of Zaraz configuration IDs
   */
  ids: Array<number>;
}

export declare namespace Configs {
  export { type ConfigGetResponse as ConfigGetResponse, type ConfigGetParams as ConfigGetParams };
}
