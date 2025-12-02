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
 * Allows a user to validate a potentially expensive query without executing it.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.validate_query}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {boolean} [params.all_shards] - If `true`, the validation is executed on all shards instead of one random shard per index.
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes.
 * @param {boolean} [params.analyze_wildcard=false] - If `true`, wildcard and prefix queries are analyzed.
 * @param {string} [params.analyzer] - Analyzer to use for the query string. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.default_operator] - The default operator for query string query: `AND` or `OR`.
 * @param {string} [params.df] - Field to use as default where no field prefix is given in the query string. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {boolean} [params.explain] - If `true`, the response returns detailed information if an error has occurred.
 * @param {boolean} [params.ignore_unavailable] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {boolean} [params.lenient] - If `true`, format-based query failures (such as providing text to a numeric field) in the query string will be ignored.
 * @param {string} [params.q] - Query in the Lucene query string syntax.
 * @param {boolean} [params.rewrite] - If `true`, returns a more detailed explanation showing the actual Lucene query that will be executed.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases to search. Supports wildcards (`*`). To search all data streams or indexes, omit this parameter or use `*` or `_all`.
 * @param {object} [params.body] - The query definition specified with the Query DSL
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function validateQueryFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_validate/query'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = validateQueryFunc;
