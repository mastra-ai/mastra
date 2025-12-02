// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Predefined extends APIResource {
  /**
   * This will update an existing predefined entry
   *
   * @example
   * ```ts
   * const predefined =
   *   await client.zeroTrust.dlp.entries.predefined.create({
   *     account_id: 'account_id',
   *     enabled: true,
   *     entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   });
   * ```
   */
  create(
    params: PredefinedCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PredefinedCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/entries/predefined`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PredefinedCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a DLP entry.
   *
   * @example
   * ```ts
   * const predefined =
   *   await client.zeroTrust.dlp.entries.predefined.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id', enabled: true },
   *   );
   * ```
   */
  update(
    entryId: string,
    params: PredefinedUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PredefinedUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dlp/entries/predefined/${entryId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PredefinedUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * This is a no-op as predefined entires can't be deleted but is needed for our
   * generated terraform API
   *
   * @example
   * ```ts
   * const predefined =
   *   await client.zeroTrust.dlp.entries.predefined.delete(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    entryId: string,
    params: PredefinedDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PredefinedDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/dlp/entries/predefined/${entryId}`,
        options,
      ) as Core.APIPromise<{ result: PredefinedDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface PredefinedCreateResponse {
  id: string;

  confidence: PredefinedCreateResponse.Confidence;

  enabled: boolean;

  name: string;

  profile_id?: string | null;
}

export namespace PredefinedCreateResponse {
  export interface Confidence {
    /**
     * Indicates whether this entry has AI remote service validation.
     */
    ai_context_available: boolean;

    /**
     * Indicates whether this entry has any form of validation that is not an AI remote
     * service.
     */
    available: boolean;
  }
}

export interface PredefinedUpdateResponse {
  id: string;

  confidence: PredefinedUpdateResponse.Confidence;

  enabled: boolean;

  name: string;

  profile_id?: string | null;
}

export namespace PredefinedUpdateResponse {
  export interface Confidence {
    /**
     * Indicates whether this entry has AI remote service validation.
     */
    ai_context_available: boolean;

    /**
     * Indicates whether this entry has any form of validation that is not an AI remote
     * service.
     */
    available: boolean;
  }
}

export type PredefinedDeleteResponse = unknown;

export interface PredefinedCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  enabled: boolean;

  /**
   * Body param:
   */
  entry_id: string;

  /**
   * Body param: This field is not actually used as the owning profile for a
   * predefined entry is already set to a predefined profile
   */
  profile_id?: string | null;
}

export interface PredefinedUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  enabled: boolean;
}

export interface PredefinedDeleteParams {
  account_id: string;
}

export declare namespace Predefined {
  export {
    type PredefinedCreateResponse as PredefinedCreateResponse,
    type PredefinedUpdateResponse as PredefinedUpdateResponse,
    type PredefinedDeleteResponse as PredefinedDeleteResponse,
    type PredefinedCreateParams as PredefinedCreateParams,
    type PredefinedUpdateParams as PredefinedUpdateParams,
    type PredefinedDeleteParams as PredefinedDeleteParams,
  };
}
