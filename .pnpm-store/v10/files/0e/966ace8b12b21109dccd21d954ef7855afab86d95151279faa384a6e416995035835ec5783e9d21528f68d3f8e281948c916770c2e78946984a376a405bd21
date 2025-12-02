// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as LanguageAPI from './language/language';
import {
  Language,
  LanguageCreateParams,
  LanguageDeleteParams,
  LanguageDeleteResponse,
  LanguageGetParams,
  LanguageUpdateParams,
} from './language/language';
import { SinglePage } from '../../../pagination';

export class Captions extends APIResource {
  language: LanguageAPI.Language = new LanguageAPI.Language(this._client);

  /**
   * Lists the available captions or subtitles for a specific video.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const caption of client.stream.captions.get(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    identifier: string,
    params: CaptionGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CaptionsSinglePage, Caption> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/stream/${identifier}/captions`,
      CaptionsSinglePage,
      options,
    );
  }
}

export class CaptionsSinglePage extends SinglePage<Caption> {}

export interface Caption {
  /**
   * Whether the caption was generated via AI.
   */
  generated?: boolean;

  /**
   * The language label displayed in the native language to users.
   */
  label?: string;

  /**
   * The language tag in BCP 47 format.
   */
  language?: string;

  /**
   * The status of a generated caption.
   */
  status?: 'ready' | 'inprogress' | 'error';
}

export interface CaptionGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Captions.CaptionsSinglePage = CaptionsSinglePage;
Captions.Language = Language;

export declare namespace Captions {
  export {
    type Caption as Caption,
    CaptionsSinglePage as CaptionsSinglePage,
    type CaptionGetParams as CaptionGetParams,
  };

  export {
    Language as Language,
    type LanguageDeleteResponse as LanguageDeleteResponse,
    type LanguageCreateParams as LanguageCreateParams,
    type LanguageUpdateParams as LanguageUpdateParams,
    type LanguageDeleteParams as LanguageDeleteParams,
    type LanguageGetParams as LanguageGetParams,
  };
}
