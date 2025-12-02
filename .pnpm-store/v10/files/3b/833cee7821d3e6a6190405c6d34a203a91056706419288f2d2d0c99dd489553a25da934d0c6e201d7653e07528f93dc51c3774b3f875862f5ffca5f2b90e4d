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
 * Returns paginated details of shard allocation on nodes.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/list/list-shards/ - list.shards}
 *
 * @memberOf API-List
 *
 * @param {object} [params]
 * @param {string} [params.bytes] - The unit used to display byte values.
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.format] - A short version of the Accept header, such as `JSON`, `YAML`.
 * @param {array} [params.h] - Comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Return help information.
 * @param {boolean} [params.local=false] - Return local information, do not retrieve the state from cluster-manager node.
 * @param {string} [params.master_timeout] DEPRECATED - Operation timeout for connection to cluster-manager node.
 * @param {null | string} [params.next_token] - Token to retrieve next page of shards.
 * @param {array} [params.s] - Comma-separated list of column names or column aliases to sort by.
 * @param {number} [params.size] - Maximum number of shards to be displayed in a page.
 * @param {string} [params.sort] - Defines order in which shards will be displayed. Accepted values are `asc` and `desc`. If `desc`, most recently created shards would be displayed first.
 * @param {string} [params.time] - The unit in which to display time values.
 * @param {boolean} [params.v=false] - Verbose mode. Display column headers.
 * @param {string} [params.index] - A comma-separated list of data streams, indexes, and aliases used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function shardsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['/_list/shards', index].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = shardsFunc;
