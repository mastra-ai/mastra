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
 * Allows to use the Mustache language to pre-render a search definition.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/search-template/ - search_template}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes. For example, a request targeting `foo*,bar*` returns an error if an index starts with `foo` but no index starts with `bar`.
 * @param {boolean} [params.ccs_minimize_roundtrips=true] - If `true`, network round-trips are minimized for cross-cluster search requests.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {boolean} [params.explain] - If `true`, the response includes additional details about score computation as part of a hit.
 * @param {boolean} [params.ignore_throttled] - If `true`, specified concrete, expanded, or aliased indexes are not included in the response when throttled.
 * @param {boolean} [params.ignore_unavailable] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {string} [params.preference=random] - Specifies the node or shard the operation should be performed on. Random by default.
 * @param {boolean} [params.profile] - If `true`, the query execution is profiled.
 * @param {boolean} [params.rest_total_hits_as_int=false] - If `true`, `hits.total` are rendered as an integer in the response.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.scroll] - Specifies how long a consistent view of the index should be maintained for scrolled search.
 * @param {string} [params.search_type] - The type of the search operation.
 * @param {boolean} [params.typed_keys] - If `true`, the response prefixes aggregation and suggester names with their respective types.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases to search. Supports wildcards (*).
 * @param {object} params.body - The search definition template and its parameters.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function searchTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_search/template'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = searchTemplateFunc;
