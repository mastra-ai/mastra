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

const { EventEmitter } = require('events');
const { URL } = require('url');
const debug = require('debug')('opensearch');
const Transport = require('./Transport');
const Connection = require('./Connection');
const { ConnectionPool, CloudConnectionPool } = require('./pool');
const Helpers = require('./Helpers');
const Serializer = require('./Serializer');
const errors = require('./errors');
const { ConfigurationError } = errors;
const { prepareHeaders } = Connection.internals;

const kInitialOptions = Symbol('opensearchjs-initial-options');
const kChild = Symbol('opensearchjs-child');
const kExtensions = Symbol('opensearchjs-extensions');
const kEventEmitter = Symbol('opensearchjs-event-emitter');

const OpenSearchAPI = require('../api/OpenSearchApi');

class Client extends OpenSearchAPI {
  constructor(opts = {}) {
    super({ ConfigurationError });
    if (opts.cloud && opts[kChild] === undefined) {
      const { id, username, password } = opts.cloud;
      // the cloud id is `cluster-name:base64encodedurl`
      // the url is a string divided by two '$', the first is the cloud url
      // the second the opensearch instance, the third the opensearchDashboards instance
      const cloudUrls = Buffer.from(id.split(':')[1], 'base64').toString().split('$');

      // TODO: remove username and password here in 8
      if (username && password) {
        opts.auth = Object.assign({}, opts.auth, { username, password });
      }
      opts.node = `https://${cloudUrls[1]}.${cloudUrls[0]}`;

      // Cloud has better performances with compression enabled
      // see https://github.com/elastic/elasticsearch-py/pull/704.
      // So unless the user specifies otherwise, we enable compression.
      if (opts.compression == null) opts.compression = 'gzip';
      if (opts.suggestCompression == null) opts.suggestCompression = true;
      if (opts.ssl == null || (opts.ssl && opts.ssl.secureProtocol == null)) {
        opts.ssl = opts.ssl || {};
        opts.ssl.secureProtocol = 'TLSv1_2_method';
      }
    }

    if (!opts.node && !opts.nodes) {
      throw new ConfigurationError('Missing node(s) option');
    }

    if (opts[kChild] === undefined) {
      const checkAuth = getAuth(opts.node || opts.nodes);
      if (checkAuth && checkAuth.username && checkAuth.password) {
        opts.auth = Object.assign({}, opts.auth, {
          username: checkAuth.username,
          password: checkAuth.password,
        });
      }
    }

    const options =
      opts[kChild] !== undefined
        ? opts[kChild].initialOptions
        : Object.assign(
            {},
            {
              Connection,
              Transport,
              Serializer,
              ConnectionPool: opts.cloud ? CloudConnectionPool : ConnectionPool,
              maxRetries: 3,
              requestTimeout: 30000,
              pingTimeout: 3000,
              sniffInterval: false,
              sniffOnStart: false,
              sniffEndpoint: '_nodes/_all/http',
              sniffOnConnectionFault: false,
              resurrectStrategy: 'ping',
              suggestCompression: false,
              compression: false,
              ssl: null,
              agent: null,
              headers: {},
              nodeFilter: null,
              nodeSelector: 'round-robin',
              generateRequestId: null,
              name: 'opensearch-js',
              auth: null,
              opaqueIdPrefix: null,
              context: null,
              proxy: null,
              enableMetaHeader: true,
              disablePrototypePoisoningProtection: false,
              enableLongNumeralSupport: false,
            },
            opts
          );

    if (process.env.OPENSEARCH_CLIENT_APIVERSIONING === 'true') {
      options.headers = Object.assign(
        { accept: 'application/vnd.opensearch+json; compatible-with=7' },
        options.headers
      );
    }

    this[kInitialOptions] = options;
    this[kExtensions] = [];
    this.name = options.name;

    if (opts[kChild] !== undefined) {
      this.serializer = options[kChild].serializer;
      this.connectionPool = options[kChild].connectionPool;
      this[kEventEmitter] = options[kChild].eventEmitter;
    } else {
      this[kEventEmitter] = new EventEmitter();
      this.serializer = new options.Serializer({
        disablePrototypePoisoningProtection: options.disablePrototypePoisoningProtection,
        enableLongNumeralSupport: options.enableLongNumeralSupport,
      });
      this.connectionPool = new options.ConnectionPool({
        pingTimeout: options.pingTimeout,
        resurrectStrategy: options.resurrectStrategy,
        ssl: options.ssl,
        agent: options.agent,
        proxy: options.proxy,
        Connection: options.Connection,
        auth: options.auth,
        emit: this[kEventEmitter].emit.bind(this[kEventEmitter]),
        sniffEnabled:
          options.sniffInterval !== false ||
          options.sniffOnStart !== false ||
          options.sniffOnConnectionFault !== false,
      });
      // Add the connections before initialize the Transport
      this.connectionPool.addConnection(options.node || options.nodes);
    }

    this.transport = new options.Transport({
      emit: this[kEventEmitter].emit.bind(this[kEventEmitter]),
      connectionPool: this.connectionPool,
      serializer: this.serializer,
      maxRetries: options.maxRetries,
      requestTimeout: options.requestTimeout,
      sniffInterval: options.sniffInterval,
      sniffOnStart: options.sniffOnStart,
      sniffOnConnectionFault: options.sniffOnConnectionFault,
      sniffEndpoint: options.sniffEndpoint,
      suggestCompression: options.suggestCompression,
      compression: options.compression,
      headers: options.headers,
      nodeFilter: options.nodeFilter,
      nodeSelector: options.nodeSelector,
      generateRequestId: options.generateRequestId,
      name: options.name,
      opaqueIdPrefix: options.opaqueIdPrefix,
      context: options.context,
      memoryCircuitBreaker: options.memoryCircuitBreaker,
      auth: options.auth,
    });

    this.helpers = new Helpers({
      client: this,
      maxRetries: options.maxRetries,
    });
  }

  get emit() {
    return this[kEventEmitter].emit.bind(this[kEventEmitter]);
  }

  get on() {
    return this[kEventEmitter].on.bind(this[kEventEmitter]);
  }

  get once() {
    return this[kEventEmitter].once.bind(this[kEventEmitter]);
  }

  get off() {
    return this[kEventEmitter].off.bind(this[kEventEmitter]);
  }

  extend(name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts;
      opts = {};
    }

    let [namespace, method] = name.split('.');
    if (method == null) {
      method = namespace;
      namespace = null;
    }

    if (namespace != null) {
      if (this[namespace] != null && this[namespace][method] != null && opts.force !== true) {
        throw new Error(`The method "${method}" already exists on namespace "${namespace}"`);
      }

      if (this[namespace] == null) this[namespace] = {};
      this[namespace][method] = fn({
        makeRequest: this.transport.request.bind(this.transport),
        result: { body: null, statusCode: null, headers: null, warnings: null },
        ConfigurationError,
      });
    } else {
      if (this[method] != null && opts.force !== true) {
        throw new Error(`The method "${method}" already exists`);
      }

      this[method] = fn({
        makeRequest: this.transport.request.bind(this.transport),
        result: { body: null, statusCode: null, headers: null, warnings: null },
        ConfigurationError,
      });
    }

    this[kExtensions].push({ name, opts, fn });
  }

  child(opts) {
    // Merge the new options with the initial ones
    const options = Object.assign({}, this[kInitialOptions], opts);
    // Pass to the child client the parent instances that cannot be overriden
    options[kChild] = {
      connectionPool: this.connectionPool,
      serializer: this.serializer,
      eventEmitter: this[kEventEmitter],
      initialOptions: options,
    };

    /* istanbul ignore else */
    if (options.auth !== undefined) {
      options.headers = prepareHeaders(options.headers, options.auth);
    }

    const client = new Client(options);
    // sync compatible check
    const tSymbol = Object.getOwnPropertySymbols(this.transport).filter(
      (symbol) => symbol.description === 'compatible check'
    )[0];
    client.transport[tSymbol] = this.transport[tSymbol];
    // Add parent extensions
    if (this[kExtensions].length > 0) {
      this[kExtensions].forEach(({ name, opts, fn }) => {
        client.extend(name, opts, fn);
      });
    }
    return client;
  }

  close(callback) {
    if (callback == null) {
      return new Promise((resolve) => {
        this.close(resolve);
      });
    }
    debug('Closing the client');
    this.connectionPool.empty(callback);
  }
}

function getAuth(node) {
  if (Array.isArray(node)) {
    for (const url of node) {
      const auth = getUsernameAndPassword(url);
      if (auth.username !== '' && auth.password !== '') {
        return auth;
      }
    }

    return null;
  }

  const auth = getUsernameAndPassword(node);
  if (auth.username !== '' && auth.password !== '') {
    return auth;
  }

  return null;

  function getUsernameAndPassword(node) {
    /* istanbul ignore else */
    if (typeof node === 'string') {
      const { username, password } = new URL(node);
      return {
        username: decodeURIComponent(username),
        password: decodeURIComponent(password),
      };
    } else if (node.url instanceof URL) {
      return {
        username: decodeURIComponent(node.url.username),
        password: decodeURIComponent(node.url.password),
      };
    }
  }
}

module.exports = { Client };
