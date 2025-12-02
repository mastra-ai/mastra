// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class IPs extends APIResource {
  /**
   * Add an IP from a prefix owned by the account to a particular address map.
   *
   * @example
   * ```ts
   * const ip = await client.addressing.addressMaps.ips.update(
   *   '055817b111884e0227e1be16a0be6ee0',
   *   '192.0.2.1',
   *   {
   *     account_id: '258def64c72dae45f3e4c8516e2111f2',
   *     body: {},
   *   },
   * );
   * ```
   */
  update(
    addressMapId: string,
    ipAddress: string,
    params: IPUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPUpdateResponse> {
    const { account_id, body } = params;
    return this._client.put(
      `/accounts/${account_id}/addressing/address_maps/${addressMapId}/ips/${ipAddress}`,
      { body: body, ...options },
    );
  }

  /**
   * Remove an IP from a particular address map.
   *
   * @example
   * ```ts
   * const ip = await client.addressing.addressMaps.ips.delete(
   *   '055817b111884e0227e1be16a0be6ee0',
   *   '192.0.2.1',
   *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   * );
   * ```
   */
  delete(
    addressMapId: string,
    ipAddress: string,
    params: IPDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IPDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(
      `/accounts/${account_id}/addressing/address_maps/${addressMapId}/ips/${ipAddress}`,
      options,
    );
  }
}

export interface IPUpdateResponse {
  errors: Array<IPUpdateResponse.Error>;

  messages: Array<IPUpdateResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;

  result_info?: IPUpdateResponse.ResultInfo;
}

export namespace IPUpdateResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }

  export interface ResultInfo {
    /**
     * Total number of results for the requested service.
     */
    count?: number;

    /**
     * Current page within paginated list of results.
     */
    page?: number;

    /**
     * Number of results per page of results.
     */
    per_page?: number;

    /**
     * Total results available without any search parameters.
     */
    total_count?: number;
  }
}

export interface IPDeleteResponse {
  errors: Array<IPDeleteResponse.Error>;

  messages: Array<IPDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;

  result_info?: IPDeleteResponse.ResultInfo;
}

export namespace IPDeleteResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }

  export interface ResultInfo {
    /**
     * Total number of results for the requested service.
     */
    count?: number;

    /**
     * Current page within paginated list of results.
     */
    page?: number;

    /**
     * Number of results per page of results.
     */
    per_page?: number;

    /**
     * Total results available without any search parameters.
     */
    total_count?: number;
  }
}

export interface IPUpdateParams {
  /**
   * Path param: Identifier of a Cloudflare account.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface IPDeleteParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

export declare namespace IPs {
  export {
    type IPUpdateResponse as IPUpdateResponse,
    type IPDeleteResponse as IPDeleteResponse,
    type IPUpdateParams as IPUpdateParams,
    type IPDeleteParams as IPDeleteParams,
  };
}
