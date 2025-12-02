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
 * Use an OpenSearch query to search for models in the index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/knn/api/#search-model - knn.search_models}
 *
 * @memberOf API-Knn
 *
 * @param {object} [params]
 * @param {array} [params._source] - Set to `true` or `false` to return the `_source` field or not, or a list of fields to return.
 * @param {array} [params._source_excludes] - List of fields to exclude from the returned `_source` field.
 * @param {array} [params._source_includes] - List of fields to extract and return from the `_source` field.
 * @param {boolean} [params.allow_no_indices] - Whether to ignore if a wildcard indexes expression resolves into no concrete indexes. (This includes `_all` string or when no indexes have been specified).
 * @param {boolean} [params.allow_partial_search_results=true] - Indicate if an error should be returned if there is a partial search failure or timeout.
 * @param {boolean} [params.analyze_wildcard=false] - Specify whether wildcard and prefix queries should be analyzed.
 * @param {string} [params.analyzer] - The analyzer to use for the query string.
 * @param {number} [params.batched_reduce_size=512] - The number of shard results that should be reduced at once on the coordinating node. This value should be used as a protection mechanism to reduce the memory overhead per search request if the potential number of shards in the request can be large.
 * @param {boolean} [params.ccs_minimize_roundtrips=true] - Indicates whether network round-trips should be minimized as part of cross-cluster search requests execution.
 * @param {string} [params.default_operator] - The default operator for query string query (AND or OR).
 * @param {string} [params.df] - The field to use as default where no field prefix is given in the query string.
 * @param {array} [params.docvalue_fields] - Comma-separated list of fields to return as the docvalue representation of a field for each hit.
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {boolean} [params.explain] - Specify whether to return detailed information about score computation as part of a hit.
 * @param {number} [params.from=0] - Starting offset.
 * @param {boolean} [params.ignore_throttled] - Whether specified concrete, expanded or aliased indexes should be ignored when throttled.
 * @param {boolean} [params.ignore_unavailable] - Whether specified concrete indexes should be ignored when unavailable (missing or closed).
 * @param {boolean} [params.lenient] - Specify whether format-based query failures (such as providing text to a numeric field) should be ignored.
 * @param {number} [params.max_concurrent_shard_requests=5] - The number of concurrent shard requests per node this search executes concurrently. This value should be used to limit the impact of the search on the cluster in order to limit the number of concurrent shard requests.
 * @param {number} [params.pre_filter_shard_size] - Threshold that enforces a pre-filter round-trip to prefilter search shards based on query rewriting if the number of shards the search request expands to exceeds the threshold. This filter round-trip can limit the number of shards significantly if for instance a shard can not match any documents based on its rewrite method, that is if date filters are mandatory to match but the shard bounds and the query are disjoint.
 * @param {string} [params.preference=random] - Specify the node or shard the operation should be performed on.
 * @param {string} [params.q] - Query in the Lucene query string syntax.
 * @param {boolean} [params.request_cache] - Specify if request cache should be used for this request or not, defaults to index level setting.
 * @param {boolean} [params.rest_total_hits_as_int=false] - Indicates whether `hits.total` should be rendered as an integer or an object in the rest search response.
 * @param {string} [params.routing] - Comma-separated list of specific routing values.
 * @param {string} [params.scroll] - Specify how long a consistent view of the index should be maintained for scrolled search.
 * @param {string} [params.search_type] - Search operation type.
 * @param {boolean} [params.seq_no_primary_term] - Specify whether to return sequence number and primary term of the last modification of each hit.
 * @param {number} [params.size=10] - Number of hits to return.
 * @param {array} [params.sort] - Comma-separated list of <field>:<direction> pairs.
 * @param {array} [params.stats] - Specific 'tag' of the request for logging and statistical purposes.
 * @param {array} [params.stored_fields] - Comma-separated list of stored fields to return.
 * @param {string} [params.suggest_field] - Specify which field to use for suggestions.
 * @param {string} [params.suggest_mode] - Specify suggest mode.
 * @param {number} [params.suggest_size] - How many suggestions to return in response.
 * @param {string} [params.suggest_text] - The source text for which the suggestions should be returned.
 * @param {number} [params.terminate_after] - The maximum number of documents to collect for each shard, upon reaching which the query execution will terminate early.
 * @param {string} [params.timeout] - Operation timeout.
 * @param {boolean} [params.track_scores] - Whether to calculate and return scores even if they are not used for sorting.
 * @param {boolean} [params.track_total_hits] - Indicate if the number of documents that match the query should be tracked.
 * @param {boolean} [params.typed_keys] - Specify whether aggregation and suggester names should be prefixed by their respective types in the response.
 * @param {boolean} [params.version] - Whether to return document version as part of a hit.
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function searchModelsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_knn/models/_search';
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = searchModelsFunc;
