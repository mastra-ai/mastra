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

/// <reference types="node" />

import { URL } from 'url';
import { inspect, InspectOptions } from 'util';
import { Readable as ReadableStream } from 'stream';
import { BasicAuth, AwsSigv4Auth } from './pool';
import * as http from 'http';
import * as https from 'https';
import * as hpagent from 'hpagent';
import { ConnectionOptions as TlsConnectionOptions } from 'tls';

export declare type agentFn = (opts: ConnectionOptions) => any;

export interface ConnectionOptions {
  url: URL;
  ssl?: TlsConnectionOptions;
  id?: string;
  headers?: Record<string, any>;
  agent?: AgentOptions | agentFn;
  status?: string;
  roles?: ConnectionRoles;
  auth?: BasicAuth | AwsSigv4Auth;
  proxy?: string | URL;
}

interface ConnectionRoles {
  cluster_manager?: boolean
  /**
  * @deprecated use cluster_manager instead
  */
  master?: boolean
  data?: boolean
  ingest?: boolean
}

interface RequestOptions extends http.ClientRequestArgs {
  asStream?: boolean;
  body?: string | Buffer | ReadableStream | null;
  querystring?: string;
}

export interface AgentOptions {
  keepAlive?: boolean;
  keepAliveMsecs?: number;
  maxSockets?: number;
  maxFreeSockets?: number;
}

export default class Connection {
  static statuses: {
    ALIVE: string;
    DEAD: string;
  };
  static roles: {
    CLUSTER_MANAGER?: string;
    /**
    * @deprecated use CLUSTER_MANAGER instead
    */
    MASTER?: string;
    DATA: string;
    INGEST: string;
  };
  url: URL;
  ssl: TlsConnectionOptions | null;
  id: string;
  headers: Record<string, any>;
  status: string;
  roles: ConnectionRoles;
  deadCount: number;
  resurrectTimeout: number;
  makeRequest: any;
  _openRequests: number;
  _status: string;
  _agent: http.Agent | https.Agent | hpagent.HttpProxyAgent | hpagent.HttpsProxyAgent;
  constructor(opts?: ConnectionOptions);
  request(
    params: RequestOptions,
    callback: (err: Error | null, response: http.IncomingMessage | null) => void
  ): http.ClientRequest;
  close(): Connection;
  setRole(role: string, enabled: boolean): Connection;
  buildRequestObject(params: any): http.ClientRequestArgs;
  // @ts-ignore
  [inspect.custom](object: any, options: InspectOptions): string;
  toJSON(): any;
}

export { };
