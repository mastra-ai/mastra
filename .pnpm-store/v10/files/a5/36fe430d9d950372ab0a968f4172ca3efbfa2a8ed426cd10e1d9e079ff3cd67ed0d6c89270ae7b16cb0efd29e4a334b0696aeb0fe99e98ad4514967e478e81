// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Bookmarks extends APIResource {
  /**
   * Create a new Bookmark application.
   *
   * @deprecated
   */
  create(
    bookmarkId: string,
    params: BookmarkCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Bookmark> {
    const { account_id, body } = params;
    return (
      this._client.post(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: Bookmark }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a configured Bookmark application.
   *
   * @deprecated
   */
  update(
    bookmarkId: string,
    params: BookmarkUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Bookmark> {
    const { account_id, body } = params;
    return (
      this._client.put(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: Bookmark }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists Bookmark applications.
   *
   * @deprecated
   */
  list(
    params: BookmarkListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<BookmarksSinglePage, Bookmark> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/access/bookmarks`, BookmarksSinglePage, options);
  }

  /**
   * Deletes a Bookmark application.
   *
   * @deprecated
   */
  delete(
    bookmarkId: string,
    params: BookmarkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BookmarkDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/access/bookmarks/${bookmarkId}`,
        options,
      ) as Core.APIPromise<{ result: BookmarkDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single Bookmark application.
   *
   * @deprecated
   */
  get(
    bookmarkId: string,
    params: BookmarkGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Bookmark> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, options) as Core.APIPromise<{
        result: Bookmark;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class BookmarksSinglePage extends SinglePage<Bookmark> {}

export interface Bookmark {
  /**
   * The unique identifier for the Bookmark application.
   */
  id?: string;

  /**
   * Displays the application in the App Launcher.
   */
  app_launcher_visible?: boolean;

  created_at?: string;

  /**
   * The domain of the Bookmark application.
   */
  domain?: string;

  /**
   * The image URL for the logo shown in the App Launcher dashboard.
   */
  logo_url?: string;

  /**
   * The name of the Bookmark application.
   */
  name?: string;

  updated_at?: string;
}

export interface BookmarkDeleteResponse {
  /**
   * UUID.
   */
  id?: string;
}

export interface BookmarkCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface BookmarkUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

export interface BookmarkListParams {
  account_id: string;
}

export interface BookmarkDeleteParams {
  account_id: string;
}

export interface BookmarkGetParams {
  account_id: string;
}

Bookmarks.BookmarksSinglePage = BookmarksSinglePage;

export declare namespace Bookmarks {
  export {
    type Bookmark as Bookmark,
    type BookmarkDeleteResponse as BookmarkDeleteResponse,
    BookmarksSinglePage as BookmarksSinglePage,
    type BookmarkCreateParams as BookmarkCreateParams,
    type BookmarkUpdateParams as BookmarkUpdateParams,
    type BookmarkListParams as BookmarkListParams,
    type BookmarkDeleteParams as BookmarkDeleteParams,
    type BookmarkGetParams as BookmarkGetParams,
  };
}
