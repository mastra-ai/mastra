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

'use strict';

const { URL } = require('url');
const debug = require('debug')('opensearch');
const Connection = require('../Connection');
const { ConfigurationError } = require('../errors');
const noop = () => {};

class BaseConnectionPool {
  constructor(opts) {
    // list of nodes and weights
    this.connections = [];
    // how many nodes we have in our scheduler
    this.size = this.connections.length;
    this.Connection = opts.Connection;
    this.emit = opts.emit || noop;
    this.auth = opts.auth || null;
    this._ssl = opts.ssl;
    this._agent = opts.agent;
    this._proxy = opts.proxy || null;
  }

  getConnection() {
    throw new Error('getConnection must be implemented');
  }

  markAlive() {
    return this;
  }

  markDead() {
    return this;
  }

  /**
   * Creates a new connection instance.
   */
  createConnection(opts) {
    if (opts instanceof Connection) {
      throw new ConfigurationError('The argument provided is already a Connection instance.');
    }
    if (typeof opts === 'string') {
      opts = this.urlToHost(opts);
    }

    if (this.auth !== null) {
      opts.auth = this.auth;
    } else if (opts.url.username !== '' && opts.url.password !== '') {
      opts.auth = {
        username: decodeURIComponent(opts.url.username),
        password: decodeURIComponent(opts.url.password),
      };
    }

    if (opts.ssl == null) opts.ssl = this._ssl;
    /* istanbul ignore else */
    if (opts.agent == null) opts.agent = this._agent;
    /* istanbul ignore else */
    if (opts.proxy == null) opts.proxy = this._proxy;

    const connection = new this.Connection(opts);

    for (const conn of this.connections) {
      if (conn.id === connection.id) {
        throw new Error(`Connection with id '${connection.id}' is already present`);
      }
    }

    return connection;
  }

  /**
   * Adds a new connection to the pool.
   *
   * @param {object|string} host
   * @returns {ConnectionPool}
   */
  addConnection(opts) {
    if (Array.isArray(opts)) {
      opts.forEach((o) => this.addConnection(o));
      return;
    }
    if (typeof opts === 'string') {
      opts = this.urlToHost(opts);
    }

    const connectionId = opts.id;
    const connectionUrl = opts.url.href;

    if (connectionId || connectionUrl) {
      const connectionById = this.connections.find((c) => c.id === connectionId);
      const connectionByUrl = this.connections.find((c) => c.id === connectionUrl);

      if (connectionById || connectionByUrl) {
        throw new ConfigurationError(
          `Connection with id '${connectionId || connectionUrl}' is already present`
        );
      }
    }

    this.update([...this.connections, opts]);
    return this.connections[this.size - 1];
  }

  /**
   * Removes a new connection to the pool.
   *
   * @param {object} connection
   * @returns {ConnectionPool}
   */
  removeConnection(connection) {
    debug('Removing connection', connection);
    return this.update(this.connections.filter((c) => c.id !== connection.id));
  }

  /**
   * Empties the connection pool.
   */
  empty(callback = noop) {
    debug('Emptying the connection pool');
    let openConnections = this.size;
    this.connections.forEach((connection) => {
      connection.close(() => {
        if (--openConnections === 0) {
          this.connections = [];
          this.size = this.connections.length;
          callback();
        }
      });
    });
  }

  /**
   * Update the ConnectionPool with new connections.
   *
   * @param {array} array of connections
   * @returns {ConnectionPool}
   */
  update(nodes) {
    debug('Updating the connection pool');
    const newConnections = [];
    const oldConnections = [];

    for (const node of nodes) {
      // if we already have a given connection in the pool
      // we mark it as alive and we do not close the connection
      // to avoid socket issues
      const connectionById = this.connections.find((c) => c.id === node.id);
      const connectionByUrl = this.connections.find((c) => c.id === node.url.href);
      if (connectionById) {
        debug(`The connection with id '${node.id}' is already present`);
        this.markAlive(connectionById);
        newConnections.push(connectionById);
        // in case the user has passed a single url (or an array of urls),
        // the connection id will be the full href; to avoid closing valid connections
        // because are not present in the pool, we check also the node url,
        // and if is already present we update its id with the opensearch provided one.
      } else if (connectionByUrl) {
        connectionByUrl.id = node.id;
        this.markAlive(connectionByUrl);
        newConnections.push(connectionByUrl);
      } else {
        newConnections.push(this.createConnection(node));
      }
    }

    const ids = nodes.map((c) => c.id);
    // remove all the dead connections and old connections
    for (const connection of this.connections) {
      if (ids.indexOf(connection.id) === -1) {
        oldConnections.push(connection);
      }
    }

    // close old connections
    oldConnections.forEach((connection) => connection.close());

    this.connections = newConnections;
    this.size = this.connections.length;

    return this;
  }

  /**
   * Transforms the nodes objects to a host object.
   *
   * @param {object} nodes
   * @returns {array} hosts
   */
  nodesToHost(nodes, protocol) {
    const ids = Object.keys(nodes);
    const hosts = [];

    for (let i = 0, len = ids.length; i < len; i++) {
      const node = nodes[ids[i]];

      // New nodes do not have the http property populated yet. Skip this for now.
      if (node.http === undefined) {
        continue;
      }

      // If there is no protocol in
      // the `publish_address` new URL will throw
      // the publish_address can have two forms:
      //   - ip:port
      //   - hostname/ip:port
      // if we encounter the second case, we should
      // use the hostname instead of the ip
      let address = node.http.publish_address;
      const parts = address.split('/');
      // the url is in the form of hostname/ip:port
      if (parts.length > 1) {
        const hostname = parts[0];
        const port = parts[1].match(/((?::))(?:[0-9]+)$/g)[0].slice(1);
        address = `${hostname}:${port}`;
      }

      address =
        address.slice(0, 4) === 'http'
          ? /* istanbul ignore next */
            address
          : `${protocol}//${address}`;
      const roles = node.roles.reduce((acc, role) => {
        acc[role] = true;
        return acc;
      }, {});

      hosts.push({
        url: new URL(address),
        id: ids[i],
        roles: Object.assign(
          {
            [Connection.roles.DATA]: false,
            [Connection.roles.INGEST]: false,
          },
          roles
        ),
      });
    }

    return hosts;
  }

  /**
   * Transforms an url string to a host object
   *
   * @param {string} url
   * @returns {object} host
   */
  urlToHost(url) {
    return {
      url: new URL(url),
    };
  }
}

module.exports = BaseConnectionPool;
