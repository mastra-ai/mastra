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

import { ApiResponse } from './Transport';

export declare class OpenSearchClientError extends Error {
  name: string;
  message: string;
}

export declare class TimeoutError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  constructor(message: string, meta: ApiResponse);
}

export declare class ConnectionError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  constructor(message: string, meta?: ApiResponse);
}

export declare class NoLivingConnectionsError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  constructor(message: string, meta: ApiResponse);
}

export declare class SerializationError extends OpenSearchClientError {
  name: string;
  message: string;
  data: any;
  constructor(message: string, data: any);
}

export declare class DeserializationError extends OpenSearchClientError {
  name: string;
  message: string;
  data: string;
  constructor(message: string, data: string);
}

export declare class ConfigurationError extends OpenSearchClientError {
  name: string;
  message: string;
  constructor(message: string);
}

export declare class ResponseError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  body: Record<string, any>;
  statusCode: number;
  headers: Record<string, any>;
  constructor(meta: ApiResponse);
}

export declare class RequestAbortedError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  constructor(message: string, meta?: ApiResponse);
}

export declare class NotCompatibleError extends OpenSearchClientError {
  name: string;
  message: string;
  meta: ApiResponse;
  constructor(meta: ApiResponse);
}
