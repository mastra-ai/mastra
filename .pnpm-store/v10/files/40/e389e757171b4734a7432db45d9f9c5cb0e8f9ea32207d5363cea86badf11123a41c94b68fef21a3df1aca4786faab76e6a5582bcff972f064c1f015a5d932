// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as Shared from '../shared';
import * as ContentAPI from './content';
import { Content, ContentGetParams } from './content';
import * as RulesAPI from './rules';
import {
  RuleDeleteParams,
  RuleDeleteResponse,
  RuleListParams,
  RuleListResponse,
  RuleListResponsesSinglePage,
  RuleUpdateParams,
  RuleUpdateResponse,
  RuleUpdateResponsesSinglePage,
  Rules,
} from './rules';
import { SinglePage } from '../../pagination';

export class Snippets extends APIResource {
  content: ContentAPI.Content = new ContentAPI.Content(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);

  /**
   * Put Snippet
   *
   * @example
   * ```ts
   * const snippet = await client.snippets.update(
   *   'snippet_name_01',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    snippetName: string,
    params: SnippetUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Snippet> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(
        `/zones/${zone_id}/snippets/${snippetName}`,
        Core.multipartFormRequestOptions({ body, ...options }),
      ) as Core.APIPromise<{ result: Snippet }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * All Snippets
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const snippet of client.snippets.list({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: SnippetListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SnippetsSinglePage, Snippet> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/snippets`, SnippetsSinglePage, options);
  }

  /**
   * Delete Snippet
   *
   * @example
   * ```ts
   * const snippet = await client.snippets.delete(
   *   'snippet_name_01',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    snippetName: string,
    params: SnippetDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SnippetDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/snippets/${snippetName}`, options);
  }

  /**
   * Snippet
   *
   * @example
   * ```ts
   * const snippet = await client.snippets.get(
   *   'snippet_name_01',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    snippetName: string,
    params: SnippetGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Snippet> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/snippets/${snippetName}`, options) as Core.APIPromise<{
        result: Snippet;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class SnippetsSinglePage extends SinglePage<Snippet> {}

/**
 * Snippet Information
 */
export interface Snippet {
  /**
   * Creation time of the snippet
   */
  created_on?: string;

  /**
   * Modification time of the snippet
   */
  modified_on?: string;

  /**
   * Snippet identifying name
   */
  snippet_name?: string;
}

export interface SnippetDeleteResponse {
  errors: Array<Shared.ResponseInfo>;

  messages: Array<Shared.ResponseInfo>;

  /**
   * Whether the API call was successful
   */
  success: true;
}

export interface SnippetUpdateParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: Content files of uploaded snippet
   */
  files?: string;

  /**
   * Body param:
   */
  metadata?: SnippetUpdateParams.Metadata;
}

export namespace SnippetUpdateParams {
  export interface Metadata {
    /**
     * Main module name of uploaded snippet
     */
    main_module?: string;
  }
}

export interface SnippetListParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface SnippetDeleteParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface SnippetGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

Snippets.SnippetsSinglePage = SnippetsSinglePage;
Snippets.Content = Content;
Snippets.Rules = Rules;
Snippets.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Snippets.RuleListResponsesSinglePage = RuleListResponsesSinglePage;

export declare namespace Snippets {
  export {
    type Snippet as Snippet,
    type SnippetDeleteResponse as SnippetDeleteResponse,
    SnippetsSinglePage as SnippetsSinglePage,
    type SnippetUpdateParams as SnippetUpdateParams,
    type SnippetListParams as SnippetListParams,
    type SnippetDeleteParams as SnippetDeleteParams,
    type SnippetGetParams as SnippetGetParams,
  };

  export { Content as Content, type ContentGetParams as ContentGetParams };

  export {
    Rules as Rules,
    type RuleUpdateResponse as RuleUpdateResponse,
    type RuleListResponse as RuleListResponse,
    type RuleDeleteResponse as RuleDeleteResponse,
    RuleUpdateResponsesSinglePage as RuleUpdateResponsesSinglePage,
    RuleListResponsesSinglePage as RuleListResponsesSinglePage,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
  };
}
