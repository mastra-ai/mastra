// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';

export class Entries extends APIResource {
  /**
   * Create IPFS Universal Path Gateway Content List Entry
   *
   * @example
   * ```ts
   * const entry =
   *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.create(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       content:
   *         'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
   *       type: 'cid',
   *     },
   *   );
   * ```
   */
  create(
    identifier: string,
    params: EntryCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(
        `/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries`,
        { body, ...options },
      ) as Core.APIPromise<{ result: EntryCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Edit IPFS Universal Path Gateway Content List Entry
   *
   * @example
   * ```ts
   * const entry =
   *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.update(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       content:
   *         'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
   *       type: 'cid',
   *     },
   *   );
   * ```
   */
  update(
    identifier: string,
    contentListEntryIdentifier: string,
    params: EntryUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(
        `/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`,
        { body, ...options },
      ) as Core.APIPromise<{ result: EntryUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List IPFS Universal Path Gateway Content List Entries
   *
   * @example
   * ```ts
   * const entries =
   *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.list(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  list(
    identifier: string,
    params: EntryListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryListResponse | null> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries`,
        options,
      ) as Core.APIPromise<{ result: EntryListResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete IPFS Universal Path Gateway Content List Entry
   *
   * @example
   * ```ts
   * const entry =
   *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.delete(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    identifier: string,
    contentListEntryIdentifier: string,
    params: EntryDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryDeleteResponse | null> {
    const { zone_id } = params;
    return (
      this._client.delete(
        `/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`,
        options,
      ) as Core.APIPromise<{ result: EntryDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * IPFS Universal Path Gateway Content List Entry Details
   *
   * @example
   * ```ts
   * const entry =
   *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.get(
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    identifier: string,
    contentListEntryIdentifier: string,
    params: EntryGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`,
        options,
      ) as Core.APIPromise<{ result: EntryGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Specify a content list entry to block.
 */
export interface EntryCreateResponse {
  /**
   * Specify the identifier of the hostname.
   */
  id?: string;

  /**
   * Specify the CID or content path of content to block.
   */
  content?: string;

  created_on?: string;

  /**
   * Specify an optional description of the content list entry.
   */
  description?: string;

  modified_on?: string;

  /**
   * Specify the type of content list entry to block.
   */
  type?: 'cid' | 'content_path';
}

/**
 * Specify a content list entry to block.
 */
export interface EntryUpdateResponse {
  /**
   * Specify the identifier of the hostname.
   */
  id?: string;

  /**
   * Specify the CID or content path of content to block.
   */
  content?: string;

  created_on?: string;

  /**
   * Specify an optional description of the content list entry.
   */
  description?: string;

  modified_on?: string;

  /**
   * Specify the type of content list entry to block.
   */
  type?: 'cid' | 'content_path';
}

export interface EntryListResponse {
  /**
   * Provides content list entries.
   */
  entries?: Array<EntryListResponse.Entry>;
}

export namespace EntryListResponse {
  /**
   * Specify a content list entry to block.
   */
  export interface Entry {
    /**
     * Specify the identifier of the hostname.
     */
    id?: string;

    /**
     * Specify the CID or content path of content to block.
     */
    content?: string;

    created_on?: string;

    /**
     * Specify an optional description of the content list entry.
     */
    description?: string;

    modified_on?: string;

    /**
     * Specify the type of content list entry to block.
     */
    type?: 'cid' | 'content_path';
  }
}

export interface EntryDeleteResponse {
  /**
   * Specify the identifier of the hostname.
   */
  id: string;
}

/**
 * Specify a content list entry to block.
 */
export interface EntryGetResponse {
  /**
   * Specify the identifier of the hostname.
   */
  id?: string;

  /**
   * Specify the CID or content path of content to block.
   */
  content?: string;

  created_on?: string;

  /**
   * Specify an optional description of the content list entry.
   */
  description?: string;

  modified_on?: string;

  /**
   * Specify the type of content list entry to block.
   */
  type?: 'cid' | 'content_path';
}

export interface EntryCreateParams {
  /**
   * Path param: Specify the identifier of the hostname.
   */
  zone_id: string;

  /**
   * Body param: Specify the CID or content path of content to block.
   */
  content: string;

  /**
   * Body param: Specify the type of content list entry to block.
   */
  type: 'cid' | 'content_path';

  /**
   * Body param: Specify an optional description of the content list entry.
   */
  description?: string;
}

export interface EntryUpdateParams {
  /**
   * Path param: Specify the identifier of the hostname.
   */
  zone_id: string;

  /**
   * Body param: Specify the CID or content path of content to block.
   */
  content: string;

  /**
   * Body param: Specify the type of content list entry to block.
   */
  type: 'cid' | 'content_path';

  /**
   * Body param: Specify an optional description of the content list entry.
   */
  description?: string;
}

export interface EntryListParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

export interface EntryDeleteParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

export interface EntryGetParams {
  /**
   * Specify the identifier of the hostname.
   */
  zone_id: string;
}

export declare namespace Entries {
  export {
    type EntryCreateResponse as EntryCreateResponse,
    type EntryUpdateResponse as EntryUpdateResponse,
    type EntryListResponse as EntryListResponse,
    type EntryDeleteResponse as EntryDeleteResponse,
    type EntryGetResponse as EntryGetResponse,
    type EntryCreateParams as EntryCreateParams,
    type EntryUpdateParams as EntryUpdateParams,
    type EntryListParams as EntryListParams,
    type EntryDeleteParams as EntryDeleteParams,
    type EntryGetParams as EntryGetParams,
  };
}
