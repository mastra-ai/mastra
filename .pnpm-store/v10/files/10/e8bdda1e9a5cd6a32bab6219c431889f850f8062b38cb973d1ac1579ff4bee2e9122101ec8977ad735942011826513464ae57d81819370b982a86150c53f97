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

const { normalizeArguments } = require('../utils');

/**
 * Performs an asynchronous search.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/async/index/#rest-api - asynchronous_search.search}
 *
 * @memberOf API-Asynchronous-Search
 *
 * @param {object} [params]
 * @param {string} [params.index] - The name of the index to be searched. Can be an individual name, a comma-separated list of indexes, or a wildcard expression of index names.
 * @param {string} [params.keep_alive] - The amount of time that the result is saved in the cluster. For example, `2d` means that the results are stored in the cluster for 48 hours.  The saved search results are deleted after this period or if the search is canceled. Note that this includes the query execution time.  If the query exceeds this amount of time, the process cancels this query automatically.
 * @param {boolean} [params.keep_on_completion] - Whether to save the results in the cluster after the search is complete. You can examine the stored results at a later time.
 * @param {string} [params.wait_for_completion_timeout] - The amount of time to wait for the results. You can poll the remaining results based on an ID. The maximum value is 300 seconds. Default is `1s`.
 * @param {object} [params.body] - The search definition using the Query DSL.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function searchFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_asynchronous_search';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = searchFunc;
