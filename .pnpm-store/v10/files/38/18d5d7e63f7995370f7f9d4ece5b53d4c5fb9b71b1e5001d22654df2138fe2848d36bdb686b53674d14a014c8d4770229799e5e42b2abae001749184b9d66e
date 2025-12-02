// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class Collections extends APIResource {
  /**
   * Deletes a collection.
   *
   * A `404 Not Found` status code will be returned, if the provided collection name
   * does not exist.
   */
  delete(
    body: CollectionDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CollectionDeleteResponse> {
    return this._client.post('/collections/delete-collection', { body, ...options });
  }

  /**
   * Adds a collection.
   *
   * If the collection already exists, a `409 Conflict` status code will be returned.
   */
  add(body: CollectionAddParams, options?: Core.RequestOptions): Core.APIPromise<CollectionAddResponse> {
    return this._client.post('/collections/add-collection', { body, ...options });
  }

  /**
   * Gets a complete list of all of your collections.
   */
  getList(
    body?: CollectionGetListParams | null | undefined,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CollectionGetListResponse> {
    return this._client.post('/collections/get-collection-list', { body, ...options });
  }
}

export interface CollectionDeleteResponse {
  /**
   * This string will always be "Success!". This may change in the future.
   */
  message?: string;
}

export interface CollectionAddResponse {
  /**
   * This string will always be "Success!". This may change in the future.
   */
  message?: string;
}

export interface CollectionGetListResponse {
  /**
   * The names of the matched collections.
   */
  collection_names: Array<string>;
}

export interface CollectionDeleteParams {
  /**
   * The name of the collection to delete.
   */
  collection_name: string;
}

export interface CollectionAddParams {
  /**
   * The name of the collection to add. The maximum length of this string is 1024
   * characters. If special characters are used, then the UTF-8 encoded string cannot
   * exceed 1024 bytes.
   */
  collection_name: string;
}

export interface CollectionGetListParams {}

export declare namespace Collections {
  export {
    type CollectionDeleteResponse as CollectionDeleteResponse,
    type CollectionAddResponse as CollectionAddResponse,
    type CollectionGetListResponse as CollectionGetListResponse,
    type CollectionDeleteParams as CollectionDeleteParams,
    type CollectionAddParams as CollectionAddParams,
    type CollectionGetListParams as CollectionGetListParams,
  };
}
