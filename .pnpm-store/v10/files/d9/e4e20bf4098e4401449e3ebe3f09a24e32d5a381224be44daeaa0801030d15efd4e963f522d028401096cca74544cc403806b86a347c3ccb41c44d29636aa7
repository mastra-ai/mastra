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
 * Allows to execute several search operations in one request.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/multi-search/ - msearch}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {boolean} [params.ccs_minimize_roundtrips=true] - If `true`, network round-trips between the coordinating node and remote clusters are minimized for cross-cluster search requests.
 * @param {number} [params.max_concurrent_searches] - Maximum number of concurrent searches the multi search API can execute.
 * @param {number} [params.max_concurrent_shard_requests=5] - Maximum number of concurrent shard requests that each sub-search request executes per node.
 * @param {number} [params.pre_filter_shard_size] - Defines a threshold that enforces a pre-filter roundtrip to prefilter search shards based on query rewriting if the number of shards the search request expands to exceeds the threshold. This filter roundtrip can limit the number of shards significantly if for instance a shard can not match any documents based on its rewrite method i.e., if date filters are mandatory to match but the shard bounds and the query are disjoint.
 * @param {boolean} [params.rest_total_hits_as_int=false] - If `true`, `hits.total` are returned as an integer in the response. Defaults to false, which returns an object.
 * @param {string} [params.search_type] - Indicates whether global term and document frequencies should be used when scoring returned documents.
 * @param {boolean} [params.typed_keys] - Specifies whether aggregation and suggester names should be prefixed by their respective types in the response.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and index aliases to search.
 * @param {array} params.body - The request definitions (metadata-search request definition pairs), separated by newlines
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function msearchFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_msearch'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, bulkBody: body }, options, callback);
}

module.exports = msearchFunc;
