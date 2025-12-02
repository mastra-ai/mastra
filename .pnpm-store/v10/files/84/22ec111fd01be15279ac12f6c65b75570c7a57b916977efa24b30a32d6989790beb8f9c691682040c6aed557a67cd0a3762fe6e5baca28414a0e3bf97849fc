// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import { isRequestOptions } from '../core';
import * as Core from '../core';

export class Status extends APIResource {
  /**
   * Gets the current indexing status across all documents.
   *
   * If a collection name is passed in, it will get the indexing status of only the
   * documents within that collection. Otherwise, it will show the cumulative status
   * across all of your collections.
   *
   * A `404 Not Found` status code will be returned, if a collection name was
   * provided, but it does not exist.
   */
  getStatus(
    body?: StatusGetStatusParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<StatusGetStatusResponse>;
  getStatus(options?: Core.RequestOptions): Core.APIPromise<StatusGetStatusResponse>;
  getStatus(
    body: StatusGetStatusParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<StatusGetStatusResponse> {
    if (isRequestOptions(body)) {
      return this.getStatus({}, body);
    }
    return this._client.post('/status/get-status', { body, ...options });
  }
}

export interface StatusGetStatusResponse {
  /**
   * The total number of documents, regardless of their status. It is guaranteed that
   * the sum of all of the other fields, is this number.
   */
  num_documents: number;

  /**
   * The number of failed documents. Failures can occur during either parsing, or
   * indexing. It can occur if the file is malformed or incomplete. If you believe
   * that the file is formatted correctly, please contact us at
   * `founders@zeroentropy.dev` to assist.
   */
  num_failed_documents: number;

  /**
   * The number of documents that are currently indexed.
   */
  num_indexed_documents: number;

  /**
   * The number of documents being indexed. Indexing occurs only after the document
   * has finished parsing.
   */
  num_indexing_documents: number;

  /**
   * The number of documents that are being parsed. This refers files of the type
   * PDF, DOCX, PPT, etc, whose images are being processed, or are waiting to be
   * processed, by our OCR system.
   */
  num_parsing_documents: number;
}

export interface StatusGetStatusParams {
  /**
   * The collection name to use. If `collection_name` is `null` or omitted, then the
   * cumulative status across all collections will be shown.
   */
  collection_name?: string | null;
}

export declare namespace Status {
  export {
    type StatusGetStatusResponse as StatusGetStatusResponse,
    type StatusGetStatusParams as StatusGetStatusParams,
  };
}
