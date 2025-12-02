// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as CustomAPI from './custom';
import * as ProfilesAPI from './profiles';

export class Predefined extends APIResource {
  /**
   * Creates a DLP predefined profile. Only supports enabling/disabling entries.
   *
   * @example
   * ```ts
   * const profile =
   *   await client.zeroTrust.dlp.profiles.predefined.create({
   *     account_id: 'account_id',
   *     profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   });
   * ```
   */
  create(
    params: PredefinedCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ProfilesAPI.Profile> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/profiles/predefined`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ProfilesAPI.Profile }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a DLP predefined profile. Only supports enabling/disabling entries.
   *
   * @example
   * ```ts
   * const profile =
   *   await client.zeroTrust.dlp.profiles.predefined.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  update(
    profileId: string,
    params: PredefinedUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ProfilesAPI.Profile> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dlp/profiles/predefined/${profileId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ProfilesAPI.Profile }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * This is a no-op as predefined profiles can't be deleted but is needed for our
   * generated terraform API
   *
   * @example
   * ```ts
   * const predefined =
   *   await client.zeroTrust.dlp.profiles.predefined.delete(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    profileId: string,
    params: PredefinedDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PredefinedDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/dlp/profiles/predefined/${profileId}`,
        options,
      ) as Core.APIPromise<{ result: PredefinedDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a predefined DLP profile by id.
   *
   * @example
   * ```ts
   * const profile =
   *   await client.zeroTrust.dlp.profiles.predefined.get(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    profileId: string,
    params: PredefinedGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ProfilesAPI.Profile> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/dlp/profiles/predefined/${profileId}`,
        options,
      ) as Core.APIPromise<{ result: ProfilesAPI.Profile }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface PredefinedProfile {
  /**
   * The id of the predefined profile (uuid).
   */
  id: string;

  allowed_match_count: number;

  entries: Array<
    | PredefinedProfile.CustomEntry
    | PredefinedProfile.PredefinedEntry
    | PredefinedProfile.IntegrationEntry
    | PredefinedProfile.ExactDataEntry
    | PredefinedProfile.DocumentFingerprintEntry
    | PredefinedProfile.WordListEntry
  >;

  /**
   * The name of the predefined profile.
   */
  name: string;

  ai_context_enabled?: boolean;

  confidence_threshold?: 'low' | 'medium' | 'high' | 'very_high';

  /**
   * Scan the context of predefined entries to only return matches surrounded by
   * keywords.
   */
  context_awareness?: ProfilesAPI.ContextAwareness;

  ocr_enabled?: boolean;

  /**
   * Whether this profile can be accessed by anyone.
   */
  open_access?: boolean;
}

export namespace PredefinedProfile {
  export interface CustomEntry {
    id: string;

    created_at: string;

    enabled: boolean;

    name: string;

    pattern: CustomAPI.Pattern;

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

export type PredefinedDeleteResponse = unknown;

export interface PredefinedCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  profile_id: string;

  /**
   * Body param:
   */
  ai_context_enabled?: boolean;

  /**
   * Body param:
   */
  allowed_match_count?: number | null;

  /**
   * Body param:
   */
  confidence_threshold?: string | null;

  /**
   * Body param: Scan the context of predefined entries to only return matches
   * surrounded by keywords.
   */
  context_awareness?: ProfilesAPI.ContextAwarenessParam;

  /**
   * @deprecated Body param:
   */
  entries?: Array<PredefinedCreateParams.Entry>;

  /**
   * Body param:
   */
  ocr_enabled?: boolean;
}

export namespace PredefinedCreateParams {
  export interface Entry {
    id: string;

    enabled: boolean;
  }
}

export interface PredefinedUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  ai_context_enabled?: boolean;

  /**
   * Body param:
   */
  allowed_match_count?: number | null;

  /**
   * Body param:
   */
  confidence_threshold?: string | null;

  /**
   * Body param: Scan the context of predefined entries to only return matches
   * surrounded by keywords.
   */
  context_awareness?: ProfilesAPI.ContextAwarenessParam;

  /**
   * @deprecated Body param:
   */
  entries?: Array<PredefinedUpdateParams.Entry>;

  /**
   * Body param:
   */
  ocr_enabled?: boolean;
}

export namespace PredefinedUpdateParams {
  export interface Entry {
    id: string;

    enabled: boolean;
  }
}

export interface PredefinedDeleteParams {
  account_id: string;
}

export interface PredefinedGetParams {
  account_id: string;
}

export declare namespace Predefined {
  export {
    type PredefinedProfile as PredefinedProfile,
    type PredefinedDeleteResponse as PredefinedDeleteResponse,
    type PredefinedCreateParams as PredefinedCreateParams,
    type PredefinedUpdateParams as PredefinedUpdateParams,
    type PredefinedDeleteParams as PredefinedDeleteParams,
    type PredefinedGetParams as PredefinedGetParams,
  };
}
