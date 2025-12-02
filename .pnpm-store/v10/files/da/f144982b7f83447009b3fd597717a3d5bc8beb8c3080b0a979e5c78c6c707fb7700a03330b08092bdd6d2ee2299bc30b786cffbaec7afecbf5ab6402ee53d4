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
 * Returns number of documents matching a query.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/count/ - count}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes.
 * @param {boolean} [params.analyze_wildcard=false] - If `true`, wildcard and prefix queries are analyzed. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.analyzer] - Analyzer to use for the query string. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.default_operator] - The default operator for query string query: `AND` or `OR`. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.df] - Field to use as default where no field prefix is given in the query string. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.expand_wildcards] - Specifies the type of index that wildcard expressions can match. Supports comma-separated values.
 * @param {boolean} [params.ignore_throttled] - If `true`, concrete, expanded or aliased indexes are ignored when frozen.
 * @param {boolean} [params.ignore_unavailable] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {boolean} [params.lenient] - If `true`, format-based query failures (such as providing text to a numeric field) in the query string will be ignored.
 * @param {number} [params.min_score] - Sets the minimum `_score` value that documents must have to be included in the result.
 * @param {string} [params.preference=random] - Specifies the node or shard the operation should be performed on. Random by default.
 * @param {string} [params.q] - Query in the Lucene query string syntax.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {number} [params.terminate_after] - Maximum number of documents to collect for each shard. If a query reaches this limit, OpenSearch terminates the query early. OpenSearch collects documents before sorting.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases to search. Supports wildcards (`*`). To search all data streams and indexes, omit this parameter or use `*` or `_all`.
 * @param {object} [params.body] - Query to restrict the results specified with the Query DSL (optional)
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function countFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_count'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = countFunc;
