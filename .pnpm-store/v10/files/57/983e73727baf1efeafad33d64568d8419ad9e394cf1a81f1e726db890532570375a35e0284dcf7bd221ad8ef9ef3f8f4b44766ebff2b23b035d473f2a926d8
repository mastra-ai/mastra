// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as ProfilesCustomAPI from '../profiles/custom';

export class Custom extends APIResource {
  /**
   * Creates a DLP custom entry.
   *
   * @example
   * ```ts
   * const custom =
   *   await client.zeroTrust.dlp.entries.custom.create({
   *     account_id: 'account_id',
   *     enabled: true,
   *     name: 'name',
   *     pattern: { regex: 'regex' },
   *     profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   });
   * ```
   */
  create(params: CustomCreateParams, options?: Core.RequestOptions): Core.APIPromise<CustomCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/entries`, { body, ...options }) as Core.APIPromise<{
        result: CustomCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a DLP entry.
   *
   * @example
   * ```ts
   * const custom =
   *   await client.zeroTrust.dlp.entries.custom.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     {
   *       account_id: 'account_id',
   *       name: 'name',
   *       pattern: { regex: 'regex' },
   *       type: 'custom',
   *     },
   *   );
   * ```
   */
  update(
    entryId: string,
    params: CustomUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dlp/entries/${entryId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CustomUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a DLP custom entry.
   *
   * @example
   * ```ts
   * const custom =
   *   await client.zeroTrust.dlp.entries.custom.delete(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    entryId: string,
    params: CustomDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CustomDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/dlp/entries/${entryId}`, options) as Core.APIPromise<{
        result: CustomDeleteResponse | null;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface CustomCreateResponse {
  id: string;

  created_at: string;

  enabled: boolean;

  name: string;

  pattern: ProfilesCustomAPI.Pattern;

  updated_at: string;

  profile_id?: string | null;
}

export type CustomUpdateResponse =
  | CustomUpdateResponse.CustomEntry
  | CustomUpdateResponse.PredefinedEntry
  | CustomUpdateResponse.IntegrationEntry
  | CustomUpdateResponse.ExactDataEntry
  | CustomUpdateResponse.DocumentFingerprintEntry
  | CustomUpdateResponse.WordListEntry;

export namespace CustomUpdateResponse {
  export interface CustomEntry {
    id: string;

    created_at: string;

    enabled: boolean;

    name: string;

    pattern: ProfilesCustomAPI.Pattern;

    type: 'custom';

    updated_at: string;

    profile_id?: string | null;
  }

  export interface PredefinedEntry {
    id: string;

    confidence: PredefinedEntry.Confidence;

    enabled: boolean;

    name: string;

    type: 'predefined';

    profile_id?: string | null;
  }

  export namespace PredefinedEntry {
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

  export interface IntegrationEntry {
    id: string;

    created_at: string;

    enabled: boolean;

    name: string;

    type: 'integration';

    updated_at: string;

    profile_id?: string | null;
  }

  export interface ExactDataEntry {
    id: string;

    /**
     * Only applies to custom word lists. Determines if the words should be matched in
     * a case-sensitive manner Cannot be set to false if secret is true
     */
    case_sensitive: boolean;

    created_at: string;

    enabled: boolean;

    name: string;

    secret: boolean;

    type: 'exact_data';

    updated_at: string;
  }

  export interface DocumentFingerprintEntry {
    id: string;

    created_at: string;

    enabled: boolean;

    name: string;

    type: 'document_fingerprint';

    updated_at: string;
  }

  export interface WordListEntry {
    id: string;

    created_at: string;

    enabled: boolean;

    name: string;

    type: 'word_list';

    updated_at: string;

    word_list: unknown;

    profile_id?: string | null;
  }
}

export type CustomDeleteResponse = unknown;

export interface CustomCreateParams {
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
  name: string;

  /**
   * Body param:
   */
  pattern: ProfilesCustomAPI.PatternParam;

  /**
   * Body param:
   */
  profile_id: string;
}

export type CustomUpdateParams =
  | CustomUpdateParams.Variant0
  | CustomUpdateParams.Variant1
  | CustomUpdateParams.Variant2;

export declare namespace CustomUpdateParams {
  export interface Variant0 {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    name: string;

    /**
     * Body param:
     */
    pattern: ProfilesCustomAPI.PatternParam;

    /**
     * Body param:
     */
    type: 'custom';

    /**
     * Body param:
     */
    enabled?: boolean;
  }

  export interface Variant1 {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    type: 'predefined';

    /**
     * Body param:
     */
    enabled?: boolean;
  }

  export interface Variant2 {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    type: 'integration';

    /**
     * Body param:
     */
    enabled?: boolean;
  }
}

export interface CustomDeleteParams {
  account_id: string;
}

export declare namespace Custom {
  export {
    type CustomCreateResponse as CustomCreateResponse,
    type CustomUpdateResponse as CustomUpdateResponse,
    type CustomDeleteResponse as CustomDeleteResponse,
    type CustomCreateParams as CustomCreateParams,
    type CustomUpdateParams as CustomUpdateParams,
    type CustomDeleteParams as CustomDeleteParams,
  };
}
