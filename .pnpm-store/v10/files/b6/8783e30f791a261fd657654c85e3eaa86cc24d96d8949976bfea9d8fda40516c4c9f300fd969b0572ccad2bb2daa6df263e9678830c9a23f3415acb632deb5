/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

import { ConnectionOptions as TlsConnectionOptions } from 'tls';
import { URL } from 'url';
import OpenSearchAPI from '../api/OpenSearchApi';
import Serializer from './Serializer';
import Helpers from './Helpers';
import Connection, { AgentOptions, agentFn } from './Connection';
import * as errors from './errors';
import Transport, {
  ApiError,
  ApiResponse,
  TransportRequestParams,
  TransportRequestOptions,
  nodeFilterFn,
  nodeSelectorFn,
  generateRequestIdFn,
  MemoryCircuitBreakerOptions,
} from './Transport'
import {
  ConnectionPool,
  ResurrectEvent,
  BasicAuth,
  AwsSigv4Auth
} from './pool';

declare type extendsCallback = (options: ClientExtendsCallbackOptions) => any;

// Extend API
interface ClientExtendsCallbackOptions {
  ConfigurationError: errors.ConfigurationError;
  makeRequest(
    params: TransportRequestParams,
    options?: TransportRequestOptions
  ): Promise<void> | void;
  result: {
    body: null;
    statusCode: null;
    headers: null;
    warnings: null;
  };
}

interface NodeOptions {
  url: URL;
  id?: string;
  agent?: AgentOptions;
  ssl?: TlsConnectionOptions;
  headers?: Record<string, any>;
  roles?: {
    cluster_manager?: boolean;
    master?: boolean; // Deprecated. Use cluster_manager instead
    data: boolean;
    ingest: boolean;
  };
}

interface ClientOptions {
  node?: string | string[] | NodeOptions | NodeOptions[];
  nodes?: string | string[] | NodeOptions | NodeOptions[];
  Connection?: typeof Connection;
  ConnectionPool?: typeof ConnectionPool;
  Transport?: typeof Transport;
  Serializer?: typeof Serializer;
  maxRetries?: number;
  requestTimeout?: number;
  pingTimeout?: number;
  sniffInterval?: number | boolean;
  sniffOnStart?: boolean;
  sniffEndpoint?: string;
  sniffOnConnectionFault?: boolean;
  resurrectStrategy?: 'ping' | 'optimistic' | 'none';
  suggestCompression?: boolean;
  compression?: 'gzip';
  ssl?: TlsConnectionOptions;
  agent?: AgentOptions | agentFn | false;
  nodeFilter?: nodeFilterFn;
  nodeSelector?: nodeSelectorFn | string;
  headers?: Record<string, any>;
  opaqueIdPrefix?: string;
  generateRequestId?: generateRequestIdFn;
  name?: string | symbol;
  auth?: BasicAuth | AwsSigv4Auth;
  context?: unknown;
  proxy?: string | URL;
  enableMetaHeader?: boolean;
  cloud?: {
    id: string;
    username?: string;
    password?: string;
  };
  disablePrototypePoisoningProtection?: boolean | 'proto' | 'constructor';
  memoryCircuitBreaker?: MemoryCircuitBreakerOptions;
  enableLongNumeralSupport?: boolean;
}

declare class Client extends OpenSearchAPI {
  constructor(opts: ClientOptions);
  connectionPool: ConnectionPool;
  transport: Transport;
  serializer: Serializer;
  extend(method: string, fn: extendsCallback): void;
  extend(method: string, opts: { force: boolean }, fn: extendsCallback): void;
  helpers: Helpers;
  child(opts?: ClientOptions): Client;
  close(callback: Function): void;
  close(): Promise<void>;
  emit(event: string | symbol, ...args: any[]): boolean;
  on(event: 'request', listener: (err: ApiError, meta: ApiResponse) => void): this;
  on(event: 'response', listener: (err: ApiError, meta: ApiResponse) => void): this;
  on(event: 'sniff', listener: (err: ApiError, meta: ApiResponse) => void): this;
  on(event: 'resurrect', listener: (err: null, meta: ResurrectEvent) => void): this;
  once(event: 'request', listener: (err: ApiError, meta: ApiResponse) => void): this;
  once(event: 'response', listener: (err: ApiError, meta: ApiResponse) => void): this;
  once(event: 'sniff', listener: (err: ApiError, meta: ApiResponse) => void): this;
  once(event: 'resurrect', listener: (err: null, meta: ResurrectEvent) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
}

export { Client, ClientOptions, NodeOptions, ClientExtendsCallbackOptions };
