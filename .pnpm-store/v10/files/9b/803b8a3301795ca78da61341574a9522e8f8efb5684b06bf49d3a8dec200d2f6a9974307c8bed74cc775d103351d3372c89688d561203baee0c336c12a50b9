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

const debug = require('debug')('opensearch');
const os = require('os');
const { gzip, unzip, createGzip } = require('zlib');
const buffer = require('buffer');
const ms = require('ms');
const { EventEmitter } = require('events');
const {
  ConnectionError,
  RequestAbortedError,
  NoLivingConnectionsError,
  ResponseError,
  ConfigurationError,
} = require('./errors');

const noop = () => {};

const compatibleCheckEmitter = new EventEmitter();
const clientVersion = require('../package.json').version;
const userAgent = `opensearch-js/${clientVersion} (${os.platform()} ${os.release()}-${os.arch()}; Node.js ${
  process.version
})`;
const MAX_BUFFER_LENGTH = buffer.constants.MAX_LENGTH;
const MAX_STRING_LENGTH = buffer.constants.MAX_STRING_LENGTH;
const HEAP_SIZE_LIMIT = require('v8').getHeapStatistics().heap_size_limit;
const kCompatibleCheck = Symbol('compatible check');
const kApiVersioning = Symbol('api versioning');

/** Default Transport Layer */
class Transport {
  constructor(opts) {
    if (typeof opts.compression === 'string' && opts.compression !== 'gzip') {
      throw new ConfigurationError(`Invalid compression: '${opts.compression}'`);
    }

    this.emit = opts.emit;
    this.connectionPool = opts.connectionPool;
    this.serializer = opts.serializer;
    this.maxRetries = opts.maxRetries;
    this.requestTimeout = toMs(opts.requestTimeout);
    this.suggestCompression = opts.suggestCompression === true;
    this.compression = opts.compression || false;
    this.context = opts.context || null;
    this.headers = Object.assign(
      {},
      { 'user-agent': userAgent },
      opts.suggestCompression === true ? { 'accept-encoding': 'gzip,deflate' } : null,
      lowerCaseHeaders(opts.headers)
    );
    this.sniffInterval = opts.sniffInterval;
    this.sniffOnConnectionFault = opts.sniffOnConnectionFault;
    this.sniffEndpoint = opts.sniffEndpoint;
    this.generateRequestId = opts.generateRequestId || generateRequestId();
    this.name = opts.name;
    this.opaqueIdPrefix = opts.opaqueIdPrefix;
    this[kCompatibleCheck] = 0; // 0 = to be checked, 1 = checking, 2 = checked-ok, 3 checked-notok
    this[kApiVersioning] = process.env.OPENSEARCH_CLIENT_APIVERSIONING === 'true';
    this.memoryCircuitBreaker = opts.memoryCircuitBreaker;

    this.nodeFilter = opts.nodeFilter || defaultNodeFilter;
    if (typeof opts.nodeSelector === 'function') {
      this.nodeSelector = opts.nodeSelector;
    } else if (opts.nodeSelector === 'round-robin') {
      this.nodeSelector = roundRobinSelector();
    } else if (opts.nodeSelector === 'random') {
      this.nodeSelector = randomSelector;
    } else {
      this.nodeSelector = roundRobinSelector();
    }

    this._sniffEnabled = typeof this.sniffInterval === 'number';
    this._nextSniff = this._sniffEnabled ? Date.now() + this.sniffInterval : 0;
    this._isSniffing = false;
    this._auth = opts.auth;

    if (opts.sniffOnStart === true) {
      // timer needed otherwise it will clash
      // with the compatible check testing
      setTimeout(() => {
        this.sniff({ reason: Transport.sniffReasons.SNIFF_ON_START });
      }, 10);
    }
  }

  /**
   * @param {Object} params
   * @param {string} params.method - HTTP Method (e.g. HEAD, GET, POST...)
   * @param {string} params.path - Relative URL path
   * @param {Object | string} [params.body] - Body of a standard request.
   * @param {Object[] | string} [params.bulkBody] - Body of a bulk request.
   * @param {Object[] | string} [params.querystring] - Querystring params.
   *
   * @param {Object} options
   * @param {number} [options.id] - Request ID
   * @param {Object} [options.context] - Object used for observability
   * @param {number} [options.maxRetries] - Max number of retries
   * @param {false | 'gzip'} [options.compression] - Request body compression, if any
   * @param {boolean} [options.asStream] - Whether to emit the response as stream
   * @param {number[]} [options.ignore] - Response's Error Status Codes to ignore
   * @param {Object} [options.headers] - Request headers
   * @param {Object | string} [options.querystring] - Request's query string
   * @param {number} [options.requestTimeout] - Max request timeout in milliseconds
   *
   * @param {function} callback - Callback that handles errors and response
   */
  request(params, options, callback) {
    options = options || {};
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    let p = null;

    // promises support
    if (callback === undefined) {
      let onFulfilled = null;
      let onRejected = null;
      p = new Promise((resolve, reject) => {
        onFulfilled = resolve;
        onRejected = reject;
      });
      callback = function callback(err, result) {
        err ? onRejected(err) : onFulfilled(result);
      };
    }

    const meta = {
      context: null,
      request: {
        params: null,
        options: null,
        id: options.id || this.generateRequestId(params, options),
      },
      name: this.name,
      connection: null,
      attempts: 0,
      aborted: false,
    };

    if (this.context != null && options.context != null) {
      meta.context = Object.assign({}, this.context, options.context);
    } else if (this.context != null) {
      meta.context = this.context;
    } else if (options.context != null) {
      meta.context = options.context;
    }

    const result = {
      body: null,
      statusCode: null,
      headers: null,
      meta,
    };

    Object.defineProperty(result, 'warnings', {
      get() {
        return this.headers && this.headers.warning
          ? this.headers.warning.split(/(?!\B"[^"]*),(?![^"]*"\B)/)
          : null;
      },
    });

    // We should not retry if we are sending a stream body, because we should store in memory
    // a copy of the stream to be able to send it again, but since we don't know in advance
    // the size of the stream, we risk to take too much memory.
    // Furthermore, copying everytime the stream is very a expensive operation.
    const maxRetries =
      isStream(params.body) || isStream(params.bulkBody)
        ? 0
        : typeof options.maxRetries === 'number'
          ? options.maxRetries
          : this.maxRetries;
    const compression = options.compression !== undefined ? options.compression : this.compression;
    let request = { abort: noop };
    const transportReturn = {
      then(onFulfilled, onRejected) {
        if (p != null) {
          return p.then(onFulfilled, onRejected);
        }
      },
      catch(onRejected) {
        if (p != null) {
          return p.catch(onRejected);
        }
      },
      abort() {
        meta.aborted = true;
        request.abort();
        debug('Aborting request', params);
        return this;
      },
      finally(onFinally) {
        if (p != null) {
          return p.finally(onFinally);
        }
      },
    };

    const makeRequest = () => {
      if (meta.aborted === true) {
        return process.nextTick(callback, new RequestAbortedError(), result);
      }
      meta.connection = this.getConnection({ requestId: meta.request.id });
      if (meta.connection == null) {
        return process.nextTick(callback, new NoLivingConnectionsError(), result);
      }
      this.emit('request', null, result);
      // perform the actual http request
      request = meta.connection.request(params, onResponse);
    };

    const onConnectionError = (err) => {
      if (err.name !== 'RequestAbortedError') {
        // if there is an error in the connection
        // let's mark the connection as dead
        this.connectionPool.markDead(meta.connection);

        if (this.sniffOnConnectionFault === true) {
          this.sniff({
            reason: Transport.sniffReasons.SNIFF_ON_CONNECTION_FAULT,
            requestId: meta.request.id,
          });
        }

        // retry logic
        if (meta.attempts < maxRetries) {
          meta.attempts++;
          debug(`Retrying request, there are still ${maxRetries - meta.attempts} attempts`, params);
          makeRequest();
          return;
        }
      }

      err.meta = result;
      this.emit('response', err, result);
      return callback(err, result);
    };

    const onResponse = (err, response) => {
      if (err !== null) {
        return onConnectionError(err);
      }

      result.statusCode = response.statusCode;
      result.headers = response.headers;

      if (options.asStream === true) {
        result.body = response;
        this.emit('response', null, result);
        callback(null, result);
        return;
      }

      const contentEncoding = (result.headers['content-encoding'] || '').toLowerCase();
      const isCompressed =
        contentEncoding.indexOf('gzip') > -1 || contentEncoding.indexOf('deflate') > -1;
      /* istanbul ignore else */
      if (result.headers['content-length'] !== undefined) {
        const contentLength = Number(result.headers['content-length']);
        // nodeJS data type limit check
        if (isCompressed && contentLength > MAX_BUFFER_LENGTH) {
          response.destroy();
          return onConnectionError(
            new RequestAbortedError(
              `The content length (${contentLength}) is bigger than the maximum allowed buffer (${MAX_BUFFER_LENGTH})`,
              result
            )
          );
        } else if (contentLength > MAX_STRING_LENGTH) {
          response.destroy();
          return onConnectionError(
            new RequestAbortedError(
              `The content length (${contentLength}) is bigger than the maximum allowed string (${MAX_STRING_LENGTH})`,
              result
            )
          );
        } else if (shouldApplyCircuitBreaker(contentLength)) {
          // Abort this response to avoid OOM crash of dashboards.
          response.destroy();
          return onConnectionError(
            new RequestAbortedError(
              `The content length (${contentLength}) is bigger than the maximum allowed heap memory limit.`,
              result
            )
          );
        }
      }
      // if the response is compressed, we must handle it
      // as buffer for allowing decompression later
      let payload = isCompressed ? [] : '';
      const onData = isCompressed
        ? (chunk) => {
            payload.push(chunk);
          }
        : (chunk) => {
            payload += chunk;
          };
      const onEnd = (err) => {
        response.removeListener('data', onData);
        response.removeListener('end', onEnd);
        response.removeListener('error', onEnd);
        response.removeListener('aborted', onAbort);

        if (err) {
          return onConnectionError(new ConnectionError(err.message));
        }

        if (isCompressed) {
          unzip(Buffer.concat(payload), onBody);
        } else {
          onBody(null, payload);
        }
      };

      const onAbort = () => {
        response.destroy();
        onEnd(new Error('Response aborted while reading the body'));
      };

      if (!isCompressed) {
        response.setEncoding('utf8');
      }

      this.emit('deserialization', null, result);
      response.on('data', onData);
      response.on('error', onEnd);
      response.on('end', onEnd);
      response.on('aborted', onAbort);
    };
    // Helper function to check if memory circuit breaker enabled and the response payload is too large to fit into available heap memory.
    const shouldApplyCircuitBreaker = (contentLength) => {
      if (!this.memoryCircuitBreaker || !this.memoryCircuitBreaker.enabled) return false;
      const maxPercentage = validateMemoryPercentage(this.memoryCircuitBreaker.maxPercentage);
      const heapUsed = process.memoryUsage().heapUsed;
      return contentLength + heapUsed > HEAP_SIZE_LIMIT * maxPercentage;
    };

    const onBody = (err, payload) => {
      if (err) {
        this.emit('response', err, result);
        return callback(err, result);
      }
      if (Buffer.isBuffer(payload)) {
        payload = payload.toString();
      }
      const isHead = params.method === 'HEAD';
      // we should attempt the payload deserialization only if:
      //    - a `content-type` is defined and is equal to `application/json`
      //    - the request is not a HEAD request
      //    - the payload is not an empty string
      if (
        result.headers['content-type'] !== undefined &&
        (result.headers['content-type'].indexOf('application/json') > -1 ||
          result.headers['content-type'].indexOf('application/vnd.opensearch+json') > -1) &&
        isHead === false &&
        payload !== ''
      ) {
        try {
          result.body = this.serializer.deserialize(payload);
        } catch (err) {
          this.emit('response', err, result);
          return callback(err, result);
        }
      } else {
        // cast to boolean if the request method was HEAD and there was no error
        result.body = isHead === true && result.statusCode < 400 ? true : payload;
      }

      // we should ignore the statusCode if the user has configured the `ignore` field with
      // the statusCode we just got or if the request method is HEAD and the statusCode is 404
      const ignoreStatusCode =
        (Array.isArray(options.ignore) && options.ignore.indexOf(result.statusCode) > -1) ||
        (isHead === true && result.statusCode === 404);

      if (
        ignoreStatusCode === false &&
        (result.statusCode === 502 || result.statusCode === 503 || result.statusCode === 504)
      ) {
        // if the statusCode is 502/3/4 we should run our retry strategy
        // and mark the connection as dead
        this.connectionPool.markDead(meta.connection);
        // retry logic (we should not retry on "429 - Too Many Requests")
        if (meta.attempts < maxRetries && result.statusCode !== 429) {
          meta.attempts++;
          debug(`Retrying request, there are still ${maxRetries - meta.attempts} attempts`, params);
          makeRequest();
          return;
        }
      } else {
        // everything has worked as expected, let's mark
        // the connection as alive (or confirm it)
        this.connectionPool.markAlive(meta.connection);
      }

      if (ignoreStatusCode === false && result.statusCode >= 400) {
        const error = new ResponseError(result);
        this.emit('response', error, result);
        callback(error, result);
      } else {
        // cast to boolean if the request method was HEAD
        if (isHead === true && result.statusCode === 404) {
          result.body = false;
        }
        this.emit('response', null, result);
        callback(null, result);
      }
    };

    const prepareRequest = () => {
      this.emit('serialization', null, result);
      const headers = Object.assign({}, this.headers, lowerCaseHeaders(options.headers));

      if (options.opaqueId !== undefined) {
        headers['x-opaque-id'] =
          this.opaqueIdPrefix !== null ? this.opaqueIdPrefix + options.opaqueId : options.opaqueId;
      }

      // handle json body
      if (params.body != null) {
        if (shouldSerialize(params.body) === true) {
          try {
            params.body = this.serializer.serialize(params.body);
          } catch (err) {
            this.emit('request', err, result);
            process.nextTick(callback, err, result);
            return transportReturn;
          }
        }

        if (params.body !== '') {
          headers['content-type'] =
            headers['content-type'] ||
            (this[kApiVersioning]
              ? 'application/vnd.opensearch+json; compatible-with=7'
              : 'application/json');
        }

        // handle ndjson body
      } else if (params.bulkBody != null) {
        if (shouldSerialize(params.bulkBody) === true) {
          try {
            params.body = this.serializer.ndserialize(params.bulkBody);
          } catch (err) {
            this.emit('request', err, result);
            process.nextTick(callback, err, result);
            return transportReturn;
          }
        } else {
          params.body = params.bulkBody;
        }
        if (params.body !== '') {
          headers['content-type'] =
            headers['content-type'] ||
            (this[kApiVersioning]
              ? 'application/vnd.opensearch+x-ndjson; compatible-with=7'
              : 'application/x-ndjson');
        }
      }

      params.headers = headers;
      // serializes the querystring
      if (options.querystring == null) {
        params.querystring = this.serializer.qserialize(params.querystring);
      } else {
        params.querystring = this.serializer.qserialize(
          Object.assign({}, params.querystring, options.querystring)
        );
      }
      if (this._auth !== null && typeof this._auth === 'object' && 'credentials' in this._auth) {
        params.auth = this._auth;
      }

      // handles request timeout
      params.timeout = toMs(options.requestTimeout || this.requestTimeout);
      if (options.asStream === true) params.asStream = true;
      meta.request.params = params;
      meta.request.options = options;

      // handle compression
      if (params.body !== '' && params.body != null) {
        if (isStream(params.body) === true) {
          if (compression === 'gzip') {
            params.headers['content-encoding'] = compression;
            params.body = params.body.pipe(createGzip());
          }
          makeRequest();
        } else if (compression === 'gzip') {
          gzip(params.body, (err, buffer) => {
            /* istanbul ignore next */
            if (err) {
              this.emit('request', err, result);
              return callback(err, result);
            }
            params.headers['content-encoding'] = compression;
            params.headers['content-length'] = '' + Buffer.byteLength(buffer);
            params.body = buffer;
            makeRequest();
          });
        } else {
          params.headers['content-length'] = '' + Buffer.byteLength(params.body);
          makeRequest();
        }
      } else {
        makeRequest();
      }
    };

    prepareRequest();

    return transportReturn;
  }

  getConnection(opts) {
    const now = Date.now();
    if (this._sniffEnabled === true && now > this._nextSniff) {
      this.sniff({ reason: Transport.sniffReasons.SNIFF_INTERVAL, requestId: opts.requestId });
    }
    return this.connectionPool.getConnection({
      filter: this.nodeFilter,
      selector: this.nodeSelector,
      requestId: opts.requestId,
      name: this.name,
      now,
    });
  }

  sniff(opts, callback = noop) {
    if (this._isSniffing === true) return;
    this._isSniffing = true;
    debug('Started sniffing request');

    if (typeof opts === 'function') {
      callback = opts;
      opts = { reason: Transport.sniffReasons.DEFAULT };
    }

    const { reason } = opts;

    const request = {
      method: 'GET',
      path: this.sniffEndpoint,
    };

    this.request(request, { id: opts.requestId }, (err, result) => {
      this._isSniffing = false;
      if (this._sniffEnabled === true) {
        this._nextSniff = Date.now() + this.sniffInterval;
      }

      if (err != null) {
        debug('Sniffing errored', err);
        result.meta.sniff = { hosts: [], reason };
        this.emit('sniff', err, result);
        return callback(err);
      }

      debug('Sniffing ended successfully', result.body);
      const protocol = result.meta.connection.url.protocol || /* istanbul ignore next */ 'http:';
      const hosts = this.connectionPool.nodesToHost(result.body.nodes, protocol);
      this.connectionPool.update(hosts);

      result.meta.sniff = { hosts, reason };
      this.emit('sniff', null, result);
      callback(null, hosts);
    });
  }

  // checkCompatibleInfo validates whether the informations are compatible
  checkCompatibleInfo() {
    debug('Start compatible check');
    this[kCompatibleCheck] = 1;
    this.request(
      {
        method: 'GET',
        path: '/',
      },
      (err, result) => {
        this[kCompatibleCheck] = 3;
        if (err) {
          debug('compatible check failed', err);
          if (err.statusCode === 401 || err.statusCode === 403) {
            this[kCompatibleCheck] = 2;
            process.emitWarning(
              'The client is unable to verify the distribution due to security privileges on the server side. Some functionality may not be compatible if the server is running an unsupported product.'
            );
            compatibleCheckEmitter.emit('compatible-check', true);
          } else {
            this[kCompatibleCheck] = 0;
            compatibleCheckEmitter.emit('compatible-check', false);
          }
        } else {
          debug('Checking OpenSearch version', result.body, result.headers);
          if (result.body.version == null || typeof result.body.version.number !== 'string') {
            debug("Can't access OpenSearch version");
            return compatibleCheckEmitter.emit('compatible-check', false);
          }

          const distribution = result.body.version.distribution;
          const version = result.body.version.number.split('.');
          const major = Number(version[0]);

          // support OpenSearch validation
          if (distribution === 'opensearch') {
            debug('Valid OpenSearch distribution');
            this[kCompatibleCheck] = 2;
            return compatibleCheckEmitter.emit('compatible-check', true);
          }

          // support odfe > v7 validation
          if (major !== 7) {
            debug('Invalid distribution');
            return compatibleCheckEmitter.emit('compatible-check', false);
          }

          debug('Valid OpenSearch distribution');
          this[kCompatibleCheck] = 2;
          compatibleCheckEmitter.emit('compatible-check', true);
        }
      }
    );
  }
}

Transport.sniffReasons = {
  SNIFF_ON_START: 'sniff-on-start',
  SNIFF_INTERVAL: 'sniff-interval',
  SNIFF_ON_CONNECTION_FAULT: 'sniff-on-connection-fault',
  // TODO: find a better name
  DEFAULT: 'default',
};

function toMs(time) {
  if (typeof time === 'string') {
    return ms(time);
  }
  return time;
}

function shouldSerialize(obj) {
  return (
    typeof obj !== 'string' && typeof obj.pipe !== 'function' && Buffer.isBuffer(obj) === false
  );
}

function isStream(obj) {
  return obj != null && typeof obj.pipe === 'function';
}

function defaultNodeFilter(node) {
  // avoid cluster_manager or master only nodes
  // TODO: remove role check on master when master is not supported
  if (
    (node.roles.cluster_manager === true || node.roles.master === true) &&
    node.roles.data === false &&
    node.roles.ingest === false
  ) {
    return false;
  }
  return true;
}

function roundRobinSelector() {
  let current = -1;
  return function _roundRobinSelector(connections) {
    if (++current >= connections.length) {
      current = 0;
    }
    return connections[current];
  };
}

function randomSelector(connections) {
  const index = Math.floor(Math.random() * connections.length);
  return connections[index];
}

function generateRequestId() {
  const maxInt = 2147483647;
  let nextReqId = 0;
  return function genReqId() {
    return (nextReqId = (nextReqId + 1) & maxInt);
  };
}

function lowerCaseHeaders(oldHeaders) {
  if (oldHeaders == null) return oldHeaders;
  const newHeaders = {};
  for (const header in oldHeaders) {
    newHeaders[header.toLowerCase()] = oldHeaders[header];
  }
  return newHeaders;
}

function validateMemoryPercentage(percentage) {
  if (percentage < 0 || percentage > 1) return 1.0;
  return percentage;
}

module.exports = Transport;
module.exports.internals = {
  defaultNodeFilter,
  roundRobinSelector,
  randomSelector,
  generateRequestId,
  lowerCaseHeaders,
  toMs,
};
