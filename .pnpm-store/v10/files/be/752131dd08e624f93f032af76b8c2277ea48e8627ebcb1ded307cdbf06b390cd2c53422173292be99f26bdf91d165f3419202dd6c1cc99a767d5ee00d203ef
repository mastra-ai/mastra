/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Readable as ReadableStream } from 'stream';
import { TransportRequestOptions, ApiError, ApiResponse, RequestBody } from './Transport';
import { Search_Request } from '../api';
import { Msearch_Request } from '../api';
import { Bulk_Request } from '../api';

export default class Helpers {
  search<TDocument = unknown>(
    params: Search_Request,
    options?: TransportRequestOptions
  ): Promise<TDocument[]>;
  scrollSearch<
    TDocument = unknown
  >(
    params: Search_Request,
    options?: TransportRequestOptions
  ): AsyncIterable<ScrollSearchResponse<TDocument>>;
  scrollDocuments<TDocument = unknown>(
    params: Search_Request,
    options?: TransportRequestOptions
  ): AsyncIterable<TDocument>;
  msearch(options?: MsearchHelperOptions, reqOptions?: TransportRequestOptions): MsearchHelper;
  bulk<TDocument = unknown>(
    options: BulkHelperOptions<TDocument>,
    reqOptions?: TransportRequestOptions
  ): BulkHelper<BulkStats>;
}

export interface ScrollSearchResponse<
  TDocument = unknown
> extends ApiResponse {
  clear: () => Promise<void>;
  documents: TDocument[];
}

export interface BulkHelper<T> extends Promise<T> {
  abort: () => BulkHelper<T>;
  readonly stats: BulkStats;
}

export interface BulkStats {
  total: number;
  failed: number;
  retry: number;
  successful: number;
  noop: number;
  time: number;
  bytes: number;
  aborted: boolean;
}

interface IndexActionOperation {
  index: {
    _index: string;
    [key: string]: any;
  };
}

interface CreateActionOperation {
  create: {
    _index: string;
    [key: string]: any;
  };
}

interface UpdateActionOperation {
  update: {
    _index: string;
    [key: string]: any;
  };
}

interface DeleteAction {
  delete: {
    _index: string;
    [key: string]: any;
  };
}

type CreateAction = CreateActionOperation | [CreateActionOperation, unknown];
type IndexAction = IndexActionOperation | [IndexActionOperation, unknown];
type UpdateAction = [UpdateActionOperation, Record<string, any>];
type Action = IndexAction | CreateAction | UpdateAction | DeleteAction;
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export interface BulkHelperOptions<TDocument = unknown> extends Omit<Bulk_Request, 'body'> {
  datasource: TDocument[] | Buffer | ReadableStream | AsyncIterator<TDocument>;
  onDocument: (doc: TDocument) => Action;
  flushBytes?: number;
  flushInterval?: number;
  concurrency?: number;
  retries?: number;
  wait?: number;
  onDrop?: (doc: OnDropDocument<TDocument>) => void;
  refreshOnCompletion?: boolean | string;
}

export interface OnDropDocument<TDocument = unknown> {
  status: number;
  error: {
    type: string;
    reason: string;
    caused_by: {
      type: string;
      reason: string;
    };
  };
  operation: Action;
  document: TDocument;
  retried: boolean;
}

export interface MsearchHelperOptions extends Omit<Msearch_Request, 'body'> {
  operations?: number;
  flushInterval?: number;
  concurrency?: number;
  retries?: number;
  wait?: number;
}

declare type callbackFn = (
  err: ApiError,
  result: ApiResponse
) => void;
export interface MsearchHelper extends Promise<void> {
  stop(error?: Error): void;
  search<
    TResponse = Record<string, any>,
    TRequestBody extends RequestBody = Record<string, any>
  >(
    header: Omit<Search_Request, 'body'>,
    body: TRequestBody
  ): Promise<ApiResponse>;
  search<
    TResponse = Record<string, any>,
    TRequestBody extends RequestBody = Record<string, any>
  >(
    header: Omit<Search_Request, 'body'>,
    body: TRequestBody,
    callback: callbackFn
  ): void;
}
