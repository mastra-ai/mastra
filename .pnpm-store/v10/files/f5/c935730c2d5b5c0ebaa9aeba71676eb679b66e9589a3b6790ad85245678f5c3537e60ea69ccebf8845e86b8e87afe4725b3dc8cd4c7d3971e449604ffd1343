// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Miscategorizations extends APIResource {
  /**
   * Allows you to submit requests to change a domain’s category.
   *
   * @example
   * ```ts
   * const miscategorization =
   *   await client.intel.miscategorizations.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  create(
    params: MiscategorizationCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<MiscategorizationCreateResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/intel/miscategorization`, { body, ...options });
  }
}

export interface MiscategorizationCreateResponse {
  errors: Array<MiscategorizationCreateResponse.Error>;

  messages: Array<MiscategorizationCreateResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace MiscategorizationCreateResponse {
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

export interface MiscategorizationCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Content category IDs to add.
   */
  content_adds?: Array<number>;

  /**
   * Body param: Content category IDs to remove.
   */
  content_removes?: Array<number>;

  /**
   * Body param:
   */
  indicator_type?: 'domain' | 'ipv4' | 'ipv6' | 'url';

  /**
   * Body param: Provide only if indicator_type is `ipv4` or `ipv6`.
   */
  ip?: string | null;

  /**
   * Body param: Security category IDs to add.
   */
  security_adds?: Array<number>;

  /**
   * Body param: Security category IDs to remove.
   */
  security_removes?: Array<number>;

  /**
   * Body param: Provide only if indicator_type is `domain` or `url`. Example if
   * indicator_type is `domain`: `example.com`. Example if indicator_type is `url`:
   * `https://example.com/news/`.
   */
  url?: string;
}

export declare namespace Miscategorizations {
  export {
    type MiscategorizationCreateResponse as MiscategorizationCreateResponse,
    type MiscategorizationCreateParams as MiscategorizationCreateParams,
  };
}
