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
 * Allows to execute several search template operations in one request.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/search-template/ - msearch_template}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {boolean} [params.ccs_minimize_roundtrips=true] - If `true`, network round-trips are minimized for cross-cluster search requests.
 * @param {number} [params.max_concurrent_searches] - Maximum number of concurrent searches the API can run.
 * @param {boolean} [params.rest_total_hits_as_int=false] - If `true`, the response returns `hits.total` as an integer. If `false`, it returns `hits.total` as an object.
 * @param {string} [params.search_type] - The type of the search operation. Available options: `query_then_fetch`, `dfs_query_then_fetch`.
 * @param {boolean} [params.typed_keys] - If `true`, the response prefixes aggregation and suggester names with their respective types.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases to search. Supports wildcards (`*`). To search all data streams and indexes, omit this parameter or use `*`.
 * @param {array} params.body - The request definitions (metadata-search request definition pairs), separated by newlines
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function msearchTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_msearch/template'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, bulkBody: body }, options, callback);
}

module.exports = msearchTemplateFunc;
