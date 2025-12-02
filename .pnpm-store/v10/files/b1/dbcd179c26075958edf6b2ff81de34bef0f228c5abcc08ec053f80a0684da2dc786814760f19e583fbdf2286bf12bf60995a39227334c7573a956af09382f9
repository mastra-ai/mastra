// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Tail extends APIResource {
  /**
   * Starts a tail that receives logs and exception from a Worker.
   *
   * @example
   * ```ts
   * const tail = await client.workers.scripts.tail.create(
   *   'this-is_my_script-01',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: {},
   *   },
   * );
   * ```
   */
  create(
    scriptName: string,
    params: TailCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TailCreateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/tails`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: TailCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a tail from a Worker.
   *
   * @example
   * ```ts
   * const tail = await client.workers.scripts.tail.delete(
   *   'this-is_my_script-01',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    scriptName: string,
    id: string,
    params: TailDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TailDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}/tails/${id}`, options);
  }

  /**
   * Get list of tails currently deployed on a Worker.
   *
   * @example
   * ```ts
   * const tail = await client.workers.scripts.tail.get(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    scriptName: string,
    params: TailGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TailGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/tails`,
        options,
      ) as Core.APIPromise<{ result: TailGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * A reference to a script that will consume logs from the attached Worker.
 */
export interface ConsumerScript {
  /**
   * Name of Worker that is to be the consumer.
   */
  service: string;

  /**
   * Optional environment if the Worker utilizes one.
   */
  environment?: string;

  /**
   * Optional dispatch namespace the script belongs to.
   */
  namespace?: string;
}

/**
 * A reference to a script that will consume logs from the attached Worker.
 */
export interface ConsumerScriptParam {
  /**
   * Name of Worker that is to be the consumer.
   */
  service: string;

  /**
   * Optional environment if the Worker utilizes one.
   */
  environment?: string;

  /**
   * Optional dispatch namespace the script belongs to.
   */
  namespace?: string;
}

export interface TailCreateResponse {
  /**
   * Identifier.
   */
  id: string;

  expires_at: string;

  url: string;
}

export interface TailDeleteResponse {
  errors: Array<TailDeleteResponse.Error>;

  messages: Array<TailDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace TailDeleteResponse {
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

export interface TailGetResponse {
  /**
   * Identifier.
   */
  id: string;

  expires_at: string;

  url: string;
}

export interface TailCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface TailDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface TailGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Tail {
  export {
    type ConsumerScript as ConsumerScript,
    type TailCreateResponse as TailCreateResponse,
    type TailDeleteResponse as TailDeleteResponse,
    type TailGetResponse as TailGetResponse,
    type TailCreateParams as TailCreateParams,
    type TailDeleteParams as TailDeleteParams,
    type TailGetParams as TailGetParams,
  };
}
