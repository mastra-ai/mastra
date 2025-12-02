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
import { SecureContextOptions } from 'tls';
import Connection, { AgentOptions, ConnectionOptions } from '../Connection';
import { nodeFilterFn, nodeSelectorFn } from '../Transport';

interface BaseConnectionPoolOptions {
  ssl?: SecureContextOptions;
  agent?: AgentOptions;
  proxy?: string | URL;
  auth?: BasicAuth | AwsSigv4Auth;
  emit: (event: string | symbol, ...args: any[]) => boolean;
  Connection: typeof Connection;
}

interface ConnectionPoolOptions extends BaseConnectionPoolOptions {
  pingTimeout?: number;
  resurrectStrategy?: 'ping' | 'optimistic' | 'none';
  sniffEnabled?: boolean;
}

interface getConnectionOptions {
  filter?: nodeFilterFn;
  selector?: nodeSelectorFn;
  requestId?: string | number;
  name?: string;
  now?: number;
}

interface BasicAuth {
  username: string;
  password: string;
}

interface AwsSigv4Auth {
  credentials : {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }
  region: string;
  service: string;
}

interface resurrectOptions {
  now?: number;
  requestId: string;
  name: string;
}

interface ResurrectEvent {
  strategy: string;
  isAlive: boolean;
  connection: Connection;
  name: string;
  request: {
    id: any;
  };
}

declare class BaseConnectionPool {
  connections: Connection[];
  size: number;
  emit: (event: string | symbol, ...args: any[]) => boolean;
  _ssl: SecureContextOptions | null;
  _agent: AgentOptions | null;
  _proxy: string | URL;
  auth: BasicAuth | AwsSigv4Auth;
  Connection: typeof Connection;
  constructor(opts?: BaseConnectionPoolOptions);
  /**
   * Marks a connection as 'alive'.
   * If needed removes the connection from the dead list
   * and then resets the `deadCount`.
   *
   * @param {object} connection
   */
  markAlive(connection: Connection): this;
  /**
   * Marks a connection as 'dead'.
   * If needed adds the connection to the dead list
   * and then increments the `deadCount`.
   *
   * @param {object} connection
   */
  markDead(connection: Connection): this;
  /**
   * Returns an alive connection if present,
   * otherwise returns a dead connection.
   * By default it filters the `cluster_manager` or `master` only nodes.
   * It uses the selector to choose which
   * connection return.
   *
   * @param {object} options (filter and selector)
   * @returns {object|null} connection
   */
  getConnection(opts?: getConnectionOptions): Connection | null;

  /**
   * Creates a new connection instance.
   * @param {object|string} opts
   * @returns {Connection}
   */
  createConnection(opts: ConnectionOptions | string): Connection;
  /**
   * Adds a new connection to the pool.
   *
   * @param {object|string} host
   * @returns {ConnectionPool}
   */
  addConnection(opts: string | ConnectionOptions | ConnectionOptions[]): Connection;
  /**
   * Removes a new connection to the pool.
   *
   * @param {object} connection
   * @returns {ConnectionPool}
   */
  removeConnection(connection: Connection): this;
  /**
   * Empties the connection pool.
   *
   */
  empty(callback?: () => void): void;
  /**
   * Update the ConnectionPool with new connections.
   *
   * @param {array} array of connections
   * @returns {ConnectionPool}
   */
  update(connections: Connection[]): this;
  /**
   * Transforms the nodes objects to a host object.
   *
   * @param {object} nodes
   * @returns {array} hosts
   */
  nodesToHost(nodes: any, protocol: string): any[];
  /**
   * Transforms an url string to a host object
   *
   * @param {string} url
   * @returns {object} host
   */
  urlToHost(url: string): ConnectionOptions;
}

declare class ConnectionPool extends BaseConnectionPool {
  static resurrectStrategies: {
    none: number;
    ping: number;
    optimistic: number;
  };
  dead: string[];
  _sniffEnabled: boolean;
  resurrectTimeout: number;
  resurrectTimeoutCutoff: number;
  pingTimeout: number;
  resurrectStrategy: number;
  constructor(opts?: ConnectionPoolOptions);

  /**
   * If enabled, tries to resurrect a connection with the given
   * resurrect strategy ('ping', 'optimistic', 'none').
   *
   * @param {object} { now, requestId, name }
   * @param {function} callback (isAlive, connection)
   */
  resurrect(
    opts: resurrectOptions,
    callback?: (isAlive: boolean | null, connection: Connection | null) => void
  ): void;

  /**
   * Empties the connection pool.
   */
  empty(callback?: () => void): void;
  /**
   * Update the ConnectionPool with new connections.
   *
   * @param {array} array of connections
   * @returns {ConnectionPool}
   */
  update(connections: Connection[]): this;
}

declare class CloudConnectionPool extends BaseConnectionPool {
  cloudConnection: Connection | null;
  constructor(opts?: BaseConnectionPoolOptions);
  getConnection(): Connection | null;
  /**
   * Empties the connection pool.
   */
  empty(callback?: () => void): void;
  /**
   * Update the ConnectionPool with new connections.
   *
   * @param {array} array of connections
   * @returns {ConnectionPool}
   */
  update(connections: Connection[]): this;
}

declare function defaultNodeFilter(node: Connection): boolean;
declare function roundRobinSelector(): (connections: Connection[]) => Connection;
declare function randomSelector(connections: Connection[]): Connection;

declare const internals: {
  defaultNodeFilter: typeof defaultNodeFilter;
  roundRobinSelector: typeof roundRobinSelector;
  randomSelector: typeof randomSelector;
};

export {
  // Interfaces
  ConnectionPoolOptions,
  getConnectionOptions,
  BasicAuth,
  AwsSigv4Auth,
  internals,
  resurrectOptions,
  ResurrectEvent,
  // Classes
  BaseConnectionPool,
  ConnectionPool,
  CloudConnectionPool,
};
