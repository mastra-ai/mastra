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

const { normalizeArguments, parsePathParam, handleMissingParam } = require('../utils');

/**
 * Allows to evaluate the quality of ranked search results over a set of typical search queries.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/rank-eval/ - rank_eval}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes. For example, a request targeting `foo*,bar*` returns an error if an index starts with `foo` but no index starts with `bar`.
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {boolean} [params.ignore_unavailable] - If `true`, missing or closed indexes are not included in the response.
 * @param {string} [params.search_type] - Search operation type
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and index aliases used to limit the request. Wildcard (`*`) expressions are supported. To target all data streams and indexes in a cluster, omit this parameter or use `_all` or `*`.
 * @param {object} params.body - The ranking evaluation search definition, including search requests, document ratings and ranking metric definition.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function rankEvalFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_rank_eval'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = rankEvalFunc;
