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
 * Lists the states of all primary and replica shards and how they are distributed.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-shards/ - cat.shards}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.bytes] - The units used to display byte values.
 * @param {string} [params.cluster_manager_timeout] - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.local=false] - Returns local information but does not retrieve the state from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {string} [params.time] - Specifies the time units, for example, `5d` or `7h`. For more information, see [Supported units](https://opensearch.org/docs/latest/api-reference/units/).
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
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

  const path = ['/_cat/shards', index].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = shardsFunc;
