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
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

'use strict';

const { normalizeArguments, parsePathParam } = require('../utils');

/**
 * Returns cluster-wide thread pool statistics per node.
By default the active, queued, and rejected statistics are returned for all thread pools.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-thread-pool/ - cat.thread_pool}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.cluster_manager_timeout] - A timeout for connection to the cluster manager node.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.local=false] - Returns local information but does not retrieve the state from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {number} [params.size] - The multiplier in which to display values.
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 * @param {string} [params.thread_pool_patterns] - A comma-separated list of thread pool names used to limit the request. Accepts wildcard expressions.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function threadPoolFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, thread_pool_patterns, ...querystring } = params;
  thread_pool_patterns = parsePathParam(thread_pool_patterns);

  const path = ['/_cat/thread_pool', thread_pool_patterns].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = threadPoolFunc;
