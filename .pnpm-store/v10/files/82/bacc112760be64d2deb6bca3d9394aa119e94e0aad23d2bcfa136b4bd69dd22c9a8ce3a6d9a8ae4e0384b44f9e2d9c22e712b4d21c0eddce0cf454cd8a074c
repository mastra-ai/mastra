// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import { SinglePage } from '../../../../../pagination';

export class Tags extends APIResource {
  /**
   * Put script tags for a script uploaded to a Workers for Platforms namespace.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const tagUpdateResponse of client.workersForPlatforms.dispatch.namespaces.scripts.tags.update(
   *   'my-dispatch-namespace',
   *   'this-is_my_script-01',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: ['my-tag'],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  update(
    dispatchNamespace: string,
    scriptName: string,
    params: TagUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TagUpdateResponsesSinglePage, TagUpdateResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`,
      TagUpdateResponsesSinglePage,
      { body: body, method: 'put', ...options },
    );
  }

  /**
   * Fetch tags from a script uploaded to a Workers for Platforms namespace.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const tagListResponse of client.workersForPlatforms.dispatch.namespaces.scripts.tags.list(
   *   'my-dispatch-namespace',
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    dispatchNamespace: string,
    scriptName: string,
    params: TagListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TagListResponsesSinglePage, TagListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`,
      TagListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete script tag for a script uploaded to a Workers for Platforms namespace.
   *
   * @example
   * ```ts
   * const tag =
   *   await client.workersForPlatforms.dispatch.namespaces.scripts.tags.delete(
   *     'my-dispatch-namespace',
   *     'this-is_my_script-01',
   *     'my-tag',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    dispatchNamespace: string,
    scriptName: string,
    tag: string,
    params: TagDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TagDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags/${tag}`,
        options,
      ) as Core.APIPromise<{ result: TagDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class TagUpdateResponsesSinglePage extends SinglePage<TagUpdateResponse> {}

export class TagListResponsesSinglePage extends SinglePage<TagListResponse> {}

/**
 * Tag to help you manage your Worker.
 */
export type TagUpdateResponse = string;

/**
 * Tag to help you manage your Worker.
 */
export type TagListResponse = string;

export type TagDeleteResponse = unknown;

export interface TagUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Tags to help you manage your Workers.
   */
  body: Array<string>;
}

export interface TagListParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface TagDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Tags.TagUpdateResponsesSinglePage = TagUpdateResponsesSinglePage;
Tags.TagListResponsesSinglePage = TagListResponsesSinglePage;

export declare namespace Tags {
  export {
    type TagUpdateResponse as TagUpdateResponse,
    type TagListResponse as TagListResponse,
    type TagDeleteResponse as TagDeleteResponse,
    TagUpdateResponsesSinglePage as TagUpdateResponsesSinglePage,
    TagListResponsesSinglePage as TagListResponsesSinglePage,
    type TagUpdateParams as TagUpdateParams,
    type TagListParams as TagListParams,
    type TagDeleteParams as TagDeleteParams,
  };
}
