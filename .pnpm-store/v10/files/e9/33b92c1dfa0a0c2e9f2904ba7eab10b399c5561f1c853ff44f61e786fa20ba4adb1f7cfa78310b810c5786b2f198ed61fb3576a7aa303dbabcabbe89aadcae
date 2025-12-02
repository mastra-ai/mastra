// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class SecurityTXT extends APIResource {
  /**
   * Update security.txt
   *
   * @example
   * ```ts
   * const securityTXT = await client.securityTXT.update({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  update(
    params: SecurityTXTUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecurityTXTUpdateResponse> {
    const { zone_id, ...body } = params;
    return this._client.put(`/zones/${zone_id}/security-center/securitytxt`, { body, ...options });
  }

  /**
   * Delete security.txt
   *
   * @example
   * ```ts
   * const securityTXT = await client.securityTXT.delete({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  delete(
    params: SecurityTXTDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecurityTXTDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/security-center/securitytxt`, options);
  }

  /**
   * Get security.txt
   *
   * @example
   * ```ts
   * const securityTXT = await client.securityTXT.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: SecurityTXTGetParams, options?: Core.RequestOptions): Core.APIPromise<SecurityTXTGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/security-center/securitytxt`, options) as Core.APIPromise<{
        result: SecurityTXTGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SecurityTXTUpdateResponse {
  errors: Array<SecurityTXTUpdateResponse.Error>;

  messages: Array<SecurityTXTUpdateResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace SecurityTXTUpdateResponse {
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
}

export interface SecurityTXTDeleteResponse {
  errors: Array<SecurityTXTDeleteResponse.Error>;

  messages: Array<SecurityTXTDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace SecurityTXTDeleteResponse {
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
}

export interface SecurityTXTGetResponse {
  acknowledgments?: Array<string>;

  canonical?: Array<string>;

  contact?: Array<string>;

  enabled?: boolean;

  encryption?: Array<string>;

  expires?: string;

  hiring?: Array<string>;

  policy?: Array<string>;

  preferredLanguages?: string;
}

export interface SecurityTXTUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  acknowledgments?: Array<string>;

  /**
   * Body param:
   */
  canonical?: Array<string>;

  /**
   * Body param:
   */
  contact?: Array<string>;

  /**
   * Body param:
   */
  enabled?: boolean;

  /**
   * Body param:
   */
  encryption?: Array<string>;

  /**
   * Body param:
   */
  expires?: string;

  /**
   * Body param:
   */
  hiring?: Array<string>;

  /**
   * Body param:
   */
  policy?: Array<string>;

  /**
   * Body param:
   */
  preferredLanguages?: string;
}

export interface SecurityTXTDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface SecurityTXTGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace SecurityTXT {
  export {
    type SecurityTXTUpdateResponse as SecurityTXTUpdateResponse,
    type SecurityTXTDeleteResponse as SecurityTXTDeleteResponse,
    type SecurityTXTGetResponse as SecurityTXTGetResponse,
    type SecurityTXTUpdateParams as SecurityTXTUpdateParams,
    type SecurityTXTDeleteParams as SecurityTXTDeleteParams,
    type SecurityTXTGetParams as SecurityTXTGetParams,
  };
}
