// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class Queries extends APIResource {
  /**
   * Get the top K documents that match the given query
   */
  topDocuments(
    body: QueryTopDocumentsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<QueryTopDocumentsResponse> {
    return this._client.post('/queries/top-documents', { body, ...options });
  }

  /**
   * Get the top K pages that match the given query
   */
  topPages(body: QueryTopPagesParams, options?: Core.RequestOptions): Core.APIPromise<QueryTopPagesResponse> {
    return this._client.post('/queries/top-pages', { body, ...options });
  }

  /**
   * Get the top K snippets that match the given query.
   *
   * You may choose between coarse and precise snippets. Precise snippets will
   * average ~200 characters, while coarse snippets will average ~2000 characters.
   * The default is coarse snippets. Use the `precise_responses` parameter to adjust.
   */
  topSnippets(
    body: QueryTopSnippetsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<QueryTopSnippetsResponse> {
    return this._client.post('/queries/top-snippets', { body, ...options });
  }
}

export interface QueryTopDocumentsResponse {
  results: Array<QueryTopDocumentsResponse.Result>;
}

export namespace QueryTopDocumentsResponse {
  export interface Result {
    /**
     * A URL to the document data, which can be used to download the raw document
     * content or to display the document in frontend applications.
     *
     * NOTE: If a `/documents/update-document` call returned a new document id, then
     * this url will be invalidated and must be retrieved again.
     */
    file_url: string;

    /**
     * The metadata for that document. Will be `None` if `include_metadata` is `False`.
     */
    metadata: { [key: string]: string | Array<string> } | null;

    /**
     * The path of the document.
     */
    path: string;

    /**
     * The relevancy score assigned to this document.
     */
    score: number;
  }
}

export interface QueryTopPagesResponse {
  results: Array<QueryTopPagesResponse.Result>;
}

export namespace QueryTopPagesResponse {
  /**
   * A Page's metadata.
   */
  export interface Result {
    /**
     * The contents of this page. This property will be null when `include_content` is
     * `false`, and a string when `include_content` is `true`.
     */
    content: string | null;

    /**
     * A URL to an image of the page. This field will only be provided if the document
     * has finished parsing, and if it is a filetype that is capable of producing
     * images (e.g. PDF, DOCX, PPT, etc). In all other cases, this field will be
     * `null`.
     *
     * NOTE: If a `/documents/update-document` call returned a new document id, then
     * this url will be invalidated and must be retrieved again.
     */
    image_url: string | null;

    /**
     * The index of this page in the document. This field is 0-indexed. So, the 1st
     * page has index 0, and the 2nd page has index 1.
     */
    page_index: number;

    /**
     * The path of the document that this page comes from.
     */
    path: string;

    /**
     * The relevancy score assigned to this page.
     */
    score: number;
  }
}

export interface QueryTopSnippetsResponse {
  /**
   * The array of associated document information. Note how each snippet has an
   * associated document path. After deduplicating the document paths, this array
   * will contain document info for each document path that is referenced by at least
   * one snippet result.
   */
  document_results: Array<QueryTopSnippetsResponse.DocumentResult>;

  /**
   * The array of snippets returned by this endpoint. Each snippet result refers to a
   * particular document path, and index range. Note that all documents, regardless
   * of filetype, are converted into `UTF-8`-encoded strings. The `start_index` and
   * `end_index` of a snippet refer to the range of characters in that string, that
   * have been matched by this snippet.
   */
  results: Array<QueryTopSnippetsResponse.Result>;
}

export namespace QueryTopSnippetsResponse {
  export interface DocumentResult {
    /**
     * A URL to the document data, which can be used to download the raw document
     * content or to display the document in frontend applications.
     *
     * NOTE: If a `/documents/update-document` call returned a new document id, then
     * this url will be invalidated and must be retrieved again.
     */
    file_url: string;

    /**
     * The metadata for that document. Will be `None` if `include_metadata` is `False`.
     */
    metadata: { [key: string]: string | Array<string> } | null;

    /**
     * The path of the document.
     */
    path: string;

    /**
     * The relevancy score assigned to this document.
     */
    score: number;
  }

  /**
   * This is a Snippet.
   *
   * A snippet refers to a particular document path, and index range. Note that all
   * documents, regardless of filetype, are converted into `UTF-8`-encoded strings.
   * The `start_index` and `end_index` refer to the range of characters in that
   * string, that have been matched by this snippet.
   */
  export interface Result {
    /**
     * The full string content of this snippet.
     */
    content: string;

    /**
     * The end index of this snippet.
     */
    end_index: number;

    /**
     * The range of page indices spanned by this snippet, as a 2-tuple of integers.
     * Inclusive on the first page_index and exclusive on the second page_index.
     */
    page_span: Array<number>;

    /**
     * The path of the document that this snippet comes from.
     */
    path: string;

    /**
     * The relevancy score assigned to this snippet.
     */
    score: number;

    /**
     * The start index of this snippet.
     */
    start_index: number;
  }
}

export interface QueryTopDocumentsParams {
  /**
   * The name of the collection.
   */
  collection_name: string;

  /**
   * The number of documents to return. If there are not enough documents matching
   * your filters, then fewer may be returned. This number must be between 1 and
   * 2048, inclusive.
   */
  k: number;

  /**
   * The natural language query to search with. This cannot exceed 4096 UTF-8 bytes.
   */
  query: string;

  /**
   * The query filter to apply. Please read [Metadata Filtering](/metadata-filtering)
   * for more information. If not provided, then all documents will be searched.
   */
  filter?: { [key: string]: unknown } | null;

  /**
   * Whether or not to include the metadata in the top documents response. If not
   * provided, then the default will be `False`.
   */
  include_metadata?: boolean;

  /**
   * This option selects between our two latency modes. The higher latency mode takes
   * longer, but can allow for more accurate responses. If desired, test both to
   * customize your search experience for your particular use-case, or use the
   * default of "low" and only swap if you need an additional improvement in search
   * result quality.
   */
  latency_mode?: 'low' | 'high';

  /**
   * The reranker to use after initial retrieval. The default is `null`. You can find
   * available model ids along with more information at
   * [/models/rerank](/api-reference/models/rerank).
   */
  reranker?: string | null;
}

export interface QueryTopPagesParams {
  /**
   * The name of the collection.
   */
  collection_name: string;

  /**
   * The number of pages to return. If there are not enough pages matching your
   * filters, then fewer may be returned. This number must be between 1 and 1024,
   * inclusive.
   */
  k: number;

  /**
   * The natural language query to search with. This cannot exceed 4096 UTF-8 bytes.
   */
  query: string;

  /**
   * The query filter to apply. Please read [Metadata Filtering](/metadata-filtering)
   * for more information. If not provided, then all documents will be searched.
   */
  filter?: { [key: string]: unknown } | null;

  /**
   * If set to true, then the content of all pages will be returned.
   */
  include_content?: boolean;

  /**
   * This option selects between our two latency modes. The higher latency mode takes
   * longer, but can allow for more accurate responses. If desired, test both to
   * customize your search experience for your particular use-case, or use the
   * default of "low" and only swap if you need an additional improvement in search
   * result quality.
   */
  latency_mode?: 'low' | 'high';
}

export interface QueryTopSnippetsParams {
  /**
   * The name of the collection.
   */
  collection_name: string;

  /**
   * The number of snippets to return. If there are not enough snippets matching your
   * filters, then fewer may be returned. This number must be between 1 and 128,
   * inclusive.
   */
  k: number;

  /**
   * The natural language query to search with. This cannot exceed 4096 characters (A
   * single UTF-8 codepoint, is considered to be 1 character).
   */
  query: string;

  /**
   * The query filter to apply. Please read [Metadata Filtering](/metadata-filtering)
   * for more information. If not provided, then all documents will be searched.
   */
  filter?: { [key: string]: unknown } | null;

  /**
   * If true, the `document_results` returns will additionally contain document
   * metadata. This is false by default, as returning metadata can add overhead if
   * the amount of data to return is large.
   */
  include_document_metadata?: boolean;

  /**
   * Enable precise responses. Precise responses will have higher latency, but
   * provide much more precise snippets. When `precise_responses` is set to `true`,
   * the responses will average 200 characters. If set to `false`, the responses will
   * average 2000 characters. The default is `false`.
   */
  precise_responses?: boolean;

  /**
   * The reranker to use after initial retrieval. The default is `null`. You can find
   * available model ids, along with more information, at
   * [/models/rerank](/api-reference/models/rerank).
   */
  reranker?: string | null;
}

export declare namespace Queries {
  export {
    type QueryTopDocumentsResponse as QueryTopDocumentsResponse,
    type QueryTopPagesResponse as QueryTopPagesResponse,
    type QueryTopSnippetsResponse as QueryTopSnippetsResponse,
    type QueryTopDocumentsParams as QueryTopDocumentsParams,
    type QueryTopPagesParams as QueryTopPagesParams,
    type QueryTopSnippetsParams as QueryTopSnippetsParams,
  };
}
