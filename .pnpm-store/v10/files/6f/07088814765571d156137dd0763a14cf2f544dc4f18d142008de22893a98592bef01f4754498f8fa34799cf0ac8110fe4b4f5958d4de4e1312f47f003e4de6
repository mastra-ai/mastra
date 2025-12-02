// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as ConfigAPI from './config';

export class Export extends APIResource {
  /**
   * Exports full current published Zaraz configuration for a zone, secret variables
   * included.
   *
   * @example
   * ```ts
   * const configuration = await client.zaraz.export.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: ExportGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigAPI.Configuration> {
    const { zone_id } = params;
    return this._client.get(`/zones/${zone_id}/settings/zaraz/export`, options);
  }
}

export interface ExportGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Export {
  export { type ExportGetParams as ExportGetParams };
}
