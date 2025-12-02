// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Accounts extends APIResource {
  /**
   * Add an account as a member of a particular address map.
   *
   * @example
   * ```ts
   * const account =
   *   await client.addressing.addressMaps.accounts.update(
   *     '055817b111884e0227e1be16a0be6ee0',
   *     {
   *       account_id: '258def64c72dae45f3e4c8516e2111f2',
   *       body: {},
   *     },
   *   );
   * ```
   */
  update(
    addressMapId: string,
    params: AccountUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AccountUpdateResponse> {
    const { account_id, body } = params;
    return this._client.put(
      `/accounts/${account_id}/addressing/address_maps/${addressMapId}/accounts/${account_id}`,
      { body: body, ...options },
    );
  }

  /**
   * Remove an account as a member of a particular address map.
   *
   * @example
   * ```ts
   * const account =
   *   await client.addressing.addressMaps.accounts.delete(
   *     '055817b111884e0227e1be16a0be6ee0',
   *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   *   );
   * ```
   */
  delete(
    addressMapId: string,
    params: AccountDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AccountDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(
      `/accounts/${account_id}/addressing/address_maps/${addressMapId}/accounts/${account_id}`,
      options,
    );
  }
}

export interface AccountUpdateResponse {
  errors: Array<AccountUpdateResponse.Error>;

  messages: Array<AccountUpdateResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;

  result_info?: AccountUpdateResponse.ResultInfo;
}

export namespace AccountUpdateResponse {
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

export interface AccountDeleteResponse {
  errors: Array<AccountDeleteResponse.Error>;

  messages: Array<AccountDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;

  result_info?: AccountDeleteResponse.ResultInfo;
}

export namespace AccountDeleteResponse {
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

export interface AccountUpdateParams {
  /**
   * Path param: Identifier of a Cloudflare account.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface AccountDeleteParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

export declare namespace Accounts {
  export {
    type AccountUpdateResponse as AccountUpdateResponse,
    type AccountDeleteResponse as AccountDeleteResponse,
    type AccountUpdateParams as AccountUpdateParams,
    type AccountDeleteParams as AccountDeleteParams,
  };
}
