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

/* eslint camelcase: 0 */

const { Readable } = require('stream');
const { promisify } = require('util');
const { ResponseError, ConfigurationError } = require('./errors');

const pImmediate = promisify(setImmediate);
const sleep = promisify(setTimeout);
const kClient = Symbol('opensearch-client');
const kMetaHeader = Symbol('meta header');
/* istanbul ignore next */
const noop = () => {};

class Helpers {
  constructor(opts) {
    this[kClient] = opts.client;
    this[kMetaHeader] = opts.metaHeader;
    this.maxRetries = opts.maxRetries;
  }

  /**
   * Runs a search operation. The only difference between client.search and this utility,
   * is that we are only returning the hits to the user and not the full OpenSearch response.
   * This helper automatically adds `filter_path=hits.hits._source` to the querystring,
   * as it will only need the documents source.
   * @param {object} params - The OpenSearch's search parameters.
   * @param {object} options - The client optional configuration for this request.
   * @return {array} The documents that matched the request.
   */
  async search(params, options) {
    appendFilterPath('hits.hits._source', params, true);
    const { body } = await this[kClient].search(params, options);
    if (body.hits && body.hits.hits) {
      return body.hits.hits.map((d) => d._source);
    }
    return [];
  }

  /**
   * Runs a scroll search operation. This function returns an async iterator, allowing
   * the user to use a for await loop to get all the results of a given search.
   * ```js
   * for await (const result of client.helpers.scrollSearch({ params })) {
   *   console.log(result)
   * }
   * ```
   * Each result represents the entire body of a single scroll search request,
   * if you just need to scroll the results, use scrollDocuments.
   * This function handles automatically retries on 429 status code.
   * @param {object} params - The OpenSearch's search parameters.
   * @param {object} options - The client optional configuration for this request.
   * @return {iterator} the async iterator
   */
  async *scrollSearch(params, options = {}) {
    if (this[kMetaHeader] !== null) {
      options.headers = options.headers || {};
    }
    // TODO: study scroll search slices
    const wait = options.wait || 5000;
    const maxRetries = options.maxRetries || this.maxRetries;
    if (Array.isArray(options.ignore)) {
      options.ignore.push(429);
    } else {
      options.ignore = [429];
    }
    params.scroll = params.scroll || '1m';
    appendFilterPath('_scroll_id', params, false);

    let response = null;
    for (let i = 0; i <= maxRetries; i++) {
      response = await this[kClient].search(params, options);
      if (response.statusCode !== 429) break;
      await sleep(wait);
    }
    if (response.statusCode === 429) {
      throw new ResponseError(response);
    }

    let scroll_id = response.body._scroll_id;
    let stop = false;
    const clear = async () => {
      stop = true;
      await this[kClient].clearScroll({ body: { scroll_id } }, { ignore: [400], ...options });
    };

    while (response.body.hits && response.body.hits.hits.length > 0) {
      // scroll id is always present in the response, but it might
      // change over time based on the number of shards
      scroll_id = response.body._scroll_id;
      response.clear = clear;
      addDocumentsGetter(response);

      yield response;

      if (stop === true) {
        break;
      }

      for (let i = 0; i <= maxRetries; i++) {
        response = await this[kClient].scroll(
          {
            scroll: params.scroll,
            rest_total_hits_as_int: params.rest_total_hits_as_int || params.restTotalHitsAsInt,
            body: { scroll_id },
          },
          options
        );
        if (response.statusCode !== 429) break;
        await sleep(wait);
      }
      if (response.statusCode === 429) {
        throw new ResponseError(response);
      }
    }

    if (stop === false) {
      await clear();
    }
  }

  /**
   * Runs a scroll search operation. This function returns an async iterator, allowing
   * the user to use a for await loop to get all the documents of a given search.
   * ```js
   * for await (const document of client.helpers.scrollSearch({ params })) {
   *   console.log(document)
   * }
   * ```
   * Each document is what you will find by running a scrollSearch and iterating on the hits array.
   * This helper automatically adds `filter_path=hits.hits._source` to the querystring,
   * as it will only need the documents source.
   * @param {object} params - The OpenSearch's search parameters.
   * @param {object} options - The client optional configuration for this request.
   * @return {iterator} the async iterator
   */
  async *scrollDocuments(params, options) {
    appendFilterPath('hits.hits._source', params, true);
    for await (const { documents } of this.scrollSearch(params, options)) {
      for (const document of documents) {
        yield document;
      }
    }
  }

  /**
   * Creates a msearch helper instance. Once you configure it, you can use the provided
   * `search` method to add new searches in the queue.
   * @param {object} options - The configuration of the msearch operations.
   * @param {object} reqOptions - The client optional configuration for this request.
   * @return {object} The possible operations to run.
   */
  msearch(options = {}, reqOptions = {}) {
    const client = this[kClient];
    const {
      operations = 5,
      concurrency = 5,
      flushInterval = 500,
      retries = this.maxRetries,
      wait = 5000,
      ...msearchOptions
    } = options;

    let stopReading = false;
    let stopError = null;
    let timeoutRef = null;
    const operationsStream = new Readable({
      objectMode: true,
      read() {},
    });

    const p = iterate();
    const helper = {
      then(onFulfilled, onRejected) {
        return p.then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return p.catch(onRejected);
      },
      stop(error = null) {
        if (stopReading === true) return;
        stopReading = true;
        stopError = error;
        operationsStream.push(null);
      },
      // TODO: support abort a single search?
      // NOTE: the validation checks are synchronous and the callback/promise will
      //       be resolved in the same tick. We might want to fix this in the future.
      search(header, body, callback) {
        if (stopReading === true) {
          const error =
            stopError === null
              ? new ConfigurationError('The msearch processor has been stopped')
              : stopError;
          return callback ? callback(error, {}) : Promise.reject(error);
        }

        if (!(typeof header === 'object' && header !== null && !Array.isArray(header))) {
          const error = new ConfigurationError('The header should be an object');
          return callback ? callback(error, {}) : Promise.reject(error);
        }

        if (!(typeof body === 'object' && body !== null && !Array.isArray(body))) {
          const error = new ConfigurationError('The body should be an object');
          return callback ? callback(error, {}) : Promise.reject(error);
        }

        let promise = null;
        if (callback === undefined) {
          let onFulfilled = null;
          let onRejected = null;
          promise = new Promise((resolve, reject) => {
            onFulfilled = resolve;
            onRejected = reject;
          });
          callback = function callback(err, result) {
            err ? onRejected(err) : onFulfilled(result);
          };
        }

        operationsStream.push([header, body, callback]);

        if (promise !== null) {
          return promise;
        }
      },
    };

    return helper;

    async function iterate() {
      const { semaphore, finish } = buildSemaphore();
      const msearchBody = [];
      const callbacks = [];
      let loadedOperations = 0;
      timeoutRef = setTimeout(onFlushTimeout, flushInterval);

      for await (const operation of operationsStream) {
        timeoutRef.refresh();
        loadedOperations += 1;
        msearchBody.push(operation[0], operation[1]);
        callbacks.push(operation[2]);
        if (loadedOperations >= operations) {
          const send = await semaphore();
          send(msearchBody.slice(), callbacks.slice());
          msearchBody.length = 0;
          callbacks.length = 0;
          loadedOperations = 0;
        }
      }

      clearTimeout(timeoutRef);
      // In some cases the previos http call does not have finished,
      // or we didn't reach the flush bytes threshold, so we force one last operation.
      if (loadedOperations > 0) {
        const send = await semaphore();
        send(msearchBody, callbacks);
      }

      await finish();

      if (stopError !== null) {
        throw stopError;
      }

      async function onFlushTimeout() {
        if (loadedOperations === 0) return;
        const msearchBodyCopy = msearchBody.slice();
        const callbacksCopy = callbacks.slice();
        msearchBody.length = 0;
        callbacks.length = 0;
        loadedOperations = 0;
        try {
          const send = await semaphore();
          send(msearchBodyCopy, callbacksCopy);
        } catch (err) {
          /* istanbul ignore next */
          helper.stop(err);
        }
      }
    }

    // This function builds a semaphore using the concurrency
    // options of the msearch helper. It is used inside the iterator
    // to guarantee that no more than the number of operations
    // allowed to run at the same time are executed.
    // It returns a semaphore function which resolves in the next tick
    // if we didn't reach the maximim concurrency yet, otherwise it returns
    // a promise that resolves as soon as one of the running request has finshed.
    // The semaphore function resolves a send function, which will be used
    // to send the actual msearch request.
    // It also returns a finish function, which returns a promise that is resolved
    // when there are no longer request running.
    function buildSemaphore() {
      let resolveSemaphore = null;
      let resolveFinish = null;
      let running = 0;

      return { semaphore, finish };

      function finish() {
        return new Promise((resolve) => {
          if (running === 0) {
            resolve();
          } else {
            resolveFinish = resolve;
          }
        });
      }

      function semaphore() {
        if (running < concurrency) {
          running += 1;
          return pImmediate(send);
        } else {
          return new Promise((resolve) => {
            resolveSemaphore = resolve;
          });
        }
      }

      function send(msearchBody, callbacks) {
        /* istanbul ignore if */
        if (running > concurrency) {
          throw new Error('Max concurrency reached');
        }
        msearchOperation(msearchBody, callbacks, () => {
          running -= 1;
          if (resolveSemaphore) {
            running += 1;
            resolveSemaphore(send);
            resolveSemaphore = null;
          } else if (resolveFinish && running === 0) {
            resolveFinish();
          }
        });
      }
    }

    function msearchOperation(msearchBody, callbacks, done) {
      let retryCount = retries;

      // Instead of going full on async-await, which would make the code easier to read,
      // we have decided to use callback style instead.
      // This because every time we use async await, V8 will create multiple promises
      // behind the scenes, making the code slightly slower.
      tryMsearch(msearchBody, callbacks, retrySearch);
      function retrySearch(msearchBody, callbacks) {
        if (msearchBody.length > 0 && retryCount > 0) {
          retryCount -= 1;
          setTimeout(tryMsearch, wait, msearchBody, callbacks, retrySearch);
          return;
        }

        done();
      }

      // This function never returns an error, if the msearch operation fails,
      // the error is dispatched to all search executors.
      function tryMsearch(msearchBody, callbacks, done) {
        client.msearch(
          Object.assign({}, msearchOptions, { body: msearchBody }),
          reqOptions,
          (err, results) => {
            const retryBody = [];
            const retryCallbacks = [];
            if (err) {
              addDocumentsGetter(results);
              for (const callback of callbacks) {
                callback(err, results);
              }
              return done(retryBody, retryCallbacks);
            }
            const { responses } = results.body;
            for (let i = 0, len = responses.length; i < len; i++) {
              const response = responses[i];
              if (response.status === 429 && retryCount > 0) {
                retryBody.push(msearchBody[i * 2]);
                retryBody.push(msearchBody[i * 2 + 1]);
                retryCallbacks.push(callbacks[i]);
                continue;
              }
              const result = { ...results, body: response };
              addDocumentsGetter(result);
              if (response.status >= 400) {
                callbacks[i](new ResponseError(result), result);
              } else {
                callbacks[i](null, result);
              }
            }
            done(retryBody, retryCallbacks);
          }
        );
      }
    }
  }

  /**
   * Creates a bulk helper instance. Once you configure it, you can pick which operation
   * to execute with the given dataset, index, create, update, and delete.
   * @param {object} options - The configuration of the bulk operation.
   * @param {object} reqOptions - The client optional configuration for this request.
   * @return {object} The possible operations to run with the datasource.
   */
  bulk(options, reqOptions = {}) {
    const client = this[kClient];
    const { serializer } = client;
    if (this[kMetaHeader] !== null) {
      reqOptions.headers = reqOptions.headers || {};
    }
    const {
      datasource,
      onDocument,
      flushBytes = 5000000,
      flushInterval = 30000,
      concurrency = 5,
      retries = this.maxRetries,
      wait = 5000,
      onDrop = noop,
      refreshOnCompletion = false,
      ...bulkOptions
    } = options;

    if (datasource === undefined) {
      return Promise.reject(new ConfigurationError('bulk helper: the datasource is required'));
    }
    if (
      !(
        Array.isArray(datasource) ||
        Buffer.isBuffer(datasource) ||
        typeof datasource.pipe === 'function' ||
        datasource[Symbol.asyncIterator]
      )
    ) {
      return Promise.reject(
        new ConfigurationError(
          'bulk helper: the datasource must be an array or a buffer or a readable stream or an async generator'
        )
      );
    }
    if (onDocument === undefined) {
      return Promise.reject(
        new ConfigurationError('bulk helper: the onDocument callback is required')
      );
    }

    let shouldAbort = false;
    let timeoutRef = null;
    const stats = {
      total: 0,
      failed: 0,
      retry: 0,
      successful: 0,
      noop: 0,
      time: 0,
      bytes: 0,
      aborted: false,
    };

    const p = iterate();
    const helper = {
      get stats() {
        return stats;
      },
      then(onFulfilled, onRejected) {
        return p.then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return p.catch(onRejected);
      },
      abort() {
        clearTimeout(timeoutRef);
        shouldAbort = true;
        stats.aborted = true;
        return this;
      },
    };

    return helper;

    /**
     * Function that iterates over the given datasource and start a bulk operation as soon
     * as it reaches the configured bulk size. It's designed to use the Node.js asynchronous
     * model at this maximum capacity, as it will collect the next body to send while there is
     * a running http call. In this way, the CPU time will be used carefully.
     * The objects will be serialized right away, to approximate the byte length of the body.
     * It creates an array of strings instead of a ndjson string because the bulkOperation
     * will navigate the body for matching failed operations with the original document.
     */
    async function iterate() {
      const { semaphore, finish } = buildSemaphore();
      const startTime = Date.now();
      const bulkBody = [];
      let actionBody = '';
      let payloadBody = '';
      let chunkBytes = 0;
      timeoutRef = setTimeout(onFlushTimeout, flushInterval);

      for await (const chunk of datasource) {
        if (shouldAbort === true) break;
        timeoutRef.refresh();
        const result = onDocument(chunk);
        const [action, payload] = Array.isArray(result) ? result : [result, chunk];
        const operation = Object.keys(action)[0];
        if (operation === 'index' || operation === 'create') {
          actionBody = serializer.serialize(action);
          payloadBody = typeof payload === 'string' ? payload : serializer.serialize(payload);
          chunkBytes += Buffer.byteLength(actionBody) + Buffer.byteLength(payloadBody);
          bulkBody.push(actionBody, payloadBody);
        } else if (operation === 'update') {
          actionBody = serializer.serialize(action);
          payloadBody =
            typeof chunk === 'string'
              ? `{"doc":${chunk}}`
              : serializer.serialize({ doc: chunk, ...payload });
          chunkBytes += Buffer.byteLength(actionBody) + Buffer.byteLength(payloadBody);
          bulkBody.push(actionBody, payloadBody);
        } else if (operation === 'delete') {
          actionBody = serializer.serialize(action);
          chunkBytes += Buffer.byteLength(actionBody);
          bulkBody.push(actionBody);
        } else {
          clearTimeout(timeoutRef);
          throw new ConfigurationError(`Bulk helper invalid action: '${operation}'`);
        }

        if (chunkBytes >= flushBytes) {
          stats.bytes += chunkBytes;
          const send = await semaphore();
          send(bulkBody.slice());
          bulkBody.length = 0;
          chunkBytes = 0;
        }
      }

      clearTimeout(timeoutRef);
      // In some cases the previos http call does not have finished,
      // or we didn't reach the flush bytes threshold, so we force one last operation.
      if (shouldAbort === false && chunkBytes > 0) {
        const send = await semaphore();
        stats.bytes += chunkBytes;
        send(bulkBody);
      }

      await finish();

      if (refreshOnCompletion) {
        await client.indices.refresh(
          {
            index: typeof refreshOnCompletion === 'string' ? refreshOnCompletion : '_all',
          },
          reqOptions
        );
      }

      stats.time = Date.now() - startTime;
      stats.total = stats.successful + stats.failed;

      return stats;

      async function onFlushTimeout() {
        if (chunkBytes === 0) return;
        stats.bytes += chunkBytes;
        const bulkBodyCopy = bulkBody.slice();
        bulkBody.length = 0;
        chunkBytes = 0;
        try {
          const send = await semaphore();
          send(bulkBodyCopy);
        } catch (err) {
          /* istanbul ignore next */
          helper.abort();
        }
      }
    }

    // This function builds a semaphore using the concurrency
    // options of the bulk helper. It is used inside the iterator
    // to guarantee that no more than the number of operations
    // allowed to run at the same time are executed.
    // It returns a semaphore function which resolves in the next tick
    // if we didn't reach the maximim concurrency yet, otherwise it returns
    // a promise that resolves as soon as one of the running request has finshed.
    // The semaphore function resolves a send function, which will be used
    // to send the actual bulk request.
    // It also returns a finish function, which returns a promise that is resolved
    // when there are no longer request running. It rejects an error if one
    // of the request has failed for some reason.
    function buildSemaphore() {
      let resolveSemaphore = null;
      let resolveFinish = null;
      let rejectFinish = null;
      let error = null;
      let running = 0;

      return { semaphore, finish };

      function finish() {
        return new Promise((resolve, reject) => {
          if (running === 0) {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          } else {
            resolveFinish = resolve;
            rejectFinish = reject;
          }
        });
      }

      function semaphore() {
        if (running < concurrency) {
          running += 1;
          return pImmediate(send);
        } else {
          return new Promise((resolve) => {
            resolveSemaphore = resolve;
          });
        }
      }

      function send(bulkBody) {
        /* istanbul ignore if */
        if (running > concurrency) {
          throw new Error('Max concurrency reached');
        }
        bulkOperation(bulkBody, (err) => {
          running -= 1;
          if (err) {
            shouldAbort = true;
            error = err;
          }
          if (resolveSemaphore) {
            running += 1;
            resolveSemaphore(send);
            resolveSemaphore = null;
          } else if (resolveFinish && running === 0) {
            if (error) {
              rejectFinish(error);
            } else {
              resolveFinish();
            }
          }
        });
      }
    }

    function bulkOperation(bulkBody, callback) {
      let retryCount = retries;
      let isRetrying = false;

      // Instead of going full on async-await, which would make the code easier to read,
      // we have decided to use callback style instead.
      // This because every time we use async await, V8 will create multiple promises
      // behind the scenes, making the code slightly slower.
      tryBulk(bulkBody, retryDocuments);
      function retryDocuments(err, bulkBody) {
        if (err) return callback(err);
        if (shouldAbort === true) return callback();

        if (bulkBody.length > 0) {
          if (retryCount > 0) {
            isRetrying = true;
            retryCount -= 1;
            stats.retry += bulkBody.length;
            setTimeout(tryBulk, wait, bulkBody, retryDocuments);
            return;
          }
          for (let i = 0, len = bulkBody.length; i < len; i = i + 2) {
            const operation = Object.keys(serializer.deserialize(bulkBody[i]))[0];
            onDrop({
              status: 429,
              error: null,
              operation: serializer.deserialize(bulkBody[i]),
              document:
                operation !== 'delete'
                  ? serializer.deserialize(bulkBody[i + 1])
                  : /* istanbul ignore next */
                    null,
              retried: isRetrying,
            });
            stats.failed += 1;
          }
        }
        callback();
      }

      function tryBulk(bulkBody, callback) {
        if (shouldAbort === true) return callback(null, []);
        client.bulk(
          Object.assign({}, bulkOptions, { body: bulkBody }),
          reqOptions,
          (err, { body }) => {
            if (err) return callback(err, null);
            if (body.errors === false) {
              stats.successful += body.items.length;
              for (const item of body.items) {
                if (item.update && item.update.result === 'noop') {
                  stats.noop++;
                }
              }
              return callback(null, []);
            }
            const retry = [];
            const { items } = body;
            for (let i = 0, len = items.length; i < len; i++) {
              const action = items[i];
              const operation = Object.keys(action)[0];
              const { status } = action[operation];
              const indexSlice = operation !== 'delete' ? i * 2 : i;

              if (status >= 400) {
                // 429 is the only staus code where we might want to retry
                // a document, because it was not an error in the document itself,
                // but the OpenSearch node were handling too many operations.
                if (status === 429) {
                  retry.push(bulkBody[indexSlice]);
                  /* istanbul ignore next */
                  if (operation !== 'delete') {
                    retry.push(bulkBody[indexSlice + 1]);
                  }
                } else {
                  onDrop({
                    status: status,
                    error: action[operation].error,
                    operation: serializer.deserialize(bulkBody[indexSlice]),
                    document:
                      operation !== 'delete'
                        ? serializer.deserialize(bulkBody[indexSlice + 1])
                        : null,
                    retried: isRetrying,
                  });
                  stats.failed += 1;
                }
              } else {
                stats.successful += 1;
              }
            }
            callback(null, retry);
          }
        );
      }
    }
  }
}

// Using a getter will improve the overall performances of the code,
// as we will reed the documents only if needed.
function addDocumentsGetter(result) {
  Object.defineProperty(result, 'documents', {
    get() {
      if (this.body.hits && this.body.hits.hits) {
        return this.body.hits.hits.map((d) => d._source);
      }
      return [];
    },
  });
}

function appendFilterPath(filter, params, force) {
  if (params.filter_path !== undefined) {
    params.filter_path += ',' + filter;
  } else if (force === true) {
    params.filter_path = filter;
  }
}

module.exports = Helpers;
