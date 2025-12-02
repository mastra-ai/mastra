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
 * Returns results matching a query.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/search/ - search}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {string} [params._source] - Indicates which source fields are returned for matching documents. These fields are returned in the `hits._source` property of the search response. Valid values are: `true` to return the entire document source; `false` to not return the document source; `<string>` to return the source fields that are specified as a comma-separated list (supports wildcard (`*`) patterns).
 * @param {string} [params._source_excludes] - A comma-separated list of source fields to exclude from the response. You can also use this parameter to exclude fields from the subset specified in `_source_includes` query parameter. If the `_source` parameter is `false`, this parameter is ignored.
 * @param {string} [params._source_includes] - A comma-separated list of source fields to include in the response. If this parameter is specified, only these source fields are returned. You can exclude fields from this subset using the `_source_excludes` query parameter. If the `_source` parameter is `false`, this parameter is ignored.
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes. For example, a request targeting `foo*,bar*` returns an error if an index starts with `foo` but no index starts with `bar`.
 * @param {boolean} [params.allow_partial_search_results=true] - If `true`, returns partial results if there are shard request timeouts or shard failures. If `false`, returns an error with no partial results.
 * @param {boolean} [params.analyze_wildcard=false] - If `true`, wildcard and prefix queries are analyzed. This parameter can only be used when the q query string parameter is specified.
 * @param {string} [params.analyzer] - Analyzer to use for the query string. This parameter can only be used when the q query string parameter is specified.
 * @param {number} [params.batched_reduce_size=512] - The number of shard results that should be reduced at once on the coordinating node. This value should be used as a protection mechanism to reduce the memory overhead per search request if the potential number of shards in the request can be large.
 * @param {string} [params.cancel_after_time_interval] - The time after which the search request will be canceled. Request-level parameter takes precedence over `cancel_after_time_interval` cluster setting.
 * @param {boolean} [params.ccs_minimize_roundtrips=true] - If `true`, network round-trips between the coordinating node and the remote clusters are minimized when executing cross-cluster search (CCS) requests.
 * @param {string} [params.default_operator] - The default operator for query string query: AND or OR. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.df] - Field to use as default where no field prefix is given in the query string. This parameter can only be used when the q query string parameter is specified.
 * @param {string} [params.docvalue_fields] - A comma-separated list of fields to return as the docvalue representation for each hit.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`.
 * @param {boolean} [params.explain] - If `true`, returns detailed information about score computation as part of a hit.
 * @param {number} [params.from=0] - Starting document offset. Needs to be non-negative. By default, you cannot page through more than 10,000 hits using the `from` and `size` parameters. To page through more hits, use the `search_after` parameter.
 * @param {boolean} [params.ignore_throttled] - If `true`, concrete, expanded or aliased indexes will be ignored when frozen.
 * @param {boolean} [params.ignore_unavailable] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {boolean} [params.include_named_queries_score=false] - Indicates whether `hit.matched_queries` should be rendered as a map that includes the name of the matched query associated with its score (true) or as an array containing the name of the matched queries (false)
 * @param {boolean} [params.lenient] - If `true`, format-based query failures (such as providing text to a numeric field) in the query string will be ignored. This parameter can only be used when the `q` query string parameter is specified.
 * @param {number} [params.max_concurrent_shard_requests=5] - Defines the number of concurrent shard requests per node this search executes concurrently. This value should be used to limit the impact of the search on the cluster in order to limit the number of concurrent shard requests.
 * @param {boolean} [params.phase_took=false] - Indicates whether to return phase-level `took` time values in the response.
 * @param {number} [params.pre_filter_shard_size] - Defines a threshold that enforces a pre-filter roundtrip to prefilter search shards based on query rewriting if the number of shards the search request expands to exceeds the threshold. This filter roundtrip can limit the number of shards significantly if for instance a shard can not match any documents based on its rewrite method (if date filters are mandatory to match but the shard bounds and the query are disjoint). When unspecified, the pre-filter phase is executed if any of these conditions is met: the request targets more than 128 shards; the request targets one or more read-only index; the primary sort of the query targets an indexed field.
 * @param {string} [params.preference=random] - Nodes and shards used for the search. By default, OpenSearch selects from eligible nodes and shards using adaptive replica selection, accounting for allocation awareness. Valid values are: `_only_local` to run the search only on shards on the local node; `_local` to, if possible, run the search on shards on the local node, or if not, select shards using the default method; `_only_nodes:<node-id>,<node-id>` to run the search on only the specified nodes IDs, where, if suitable shards exist on more than one selected node, use shards on those nodes using the default method, or if none of the specified nodes are available, select shards from any available node using the default method; `_prefer_nodes:<node-id>,<node-id>` to if possible, run the search on the specified nodes IDs, or if not, select shards using the default method; `_shards:<shard>,<shard>` to run the search only on the specified shards; `<custom-string>` (any string that does not start with `_`) to route searches with the same `<custom-string>` to the same shards in the same order.
 * @param {string} [params.q] - Query in the Lucene query string syntax using query parameter search. Query parameter searches do not support the full OpenSearch Query DSL but are handy for testing.
 * @param {boolean} [params.request_cache] - If `true`, the caching of search results is enabled for requests where `size` is `0`. Defaults to index level settings.
 * @param {boolean} [params.rest_total_hits_as_int=false] - Indicates whether `hits.total` should be rendered as an integer or an object in the rest search response.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.scroll] - Period to retain the search context for scrolling. See Scroll search results. By default, this value cannot exceed `1d` (24 hours). You can change this limit using the `search.max_keep_alive` cluster-level setting.
 * @param {string} [params.search_pipeline] - Customizable sequence of processing stages applied to search queries.
 * @param {string} [params.search_type] - How distributed term frequencies are calculated for relevance scoring.
 * @param {boolean} [params.seq_no_primary_term] - If `true`, returns sequence number and primary term of the last modification of each hit.
 * @param {number} [params.size=10] - Defines the number of hits to return. By default, you cannot page through more than 10,000 hits using the `from` and `size` parameters. To page through more hits, use the `search_after` parameter.
 * @param {string} [params.sort] - A comma-separated list of <field>:<direction> pairs.
 * @param {array} [params.stats] - Specific `tag` of the request for logging and statistical purposes.
 * @param {string} [params.stored_fields] - A comma-separated list of stored fields to return as part of a hit. If no fields are specified, no stored fields are included in the response. If this field is specified, the `_source` parameter defaults to `false`. You can pass `_source: true` to return both source fields and stored fields in the search response.
 * @param {string} [params.suggest_field] - Specifies which field to use for suggestions.
 * @param {string} [params.suggest_mode] - Specifies the suggest mode. This parameter can only be used when the `suggest_field` and `suggest_text` query string parameters are specified.
 * @param {number} [params.suggest_size] - Number of suggestions to return. This parameter can only be used when the `suggest_field` and `suggest_text` query string parameters are specified.
 * @param {string} [params.suggest_text] - The source text for which the suggestions should be returned. This parameter can only be used when the `suggest_field` and `suggest_text` query string parameters are specified.
 * @param {number} [params.terminate_after] - Maximum number of documents to collect for each shard. If a query reaches this limit, OpenSearch terminates the query early. OpenSearch collects documents before sorting. Use with caution. OpenSearch applies this parameter to each shard handling the request. When possible, let OpenSearch perform early termination automatically. Avoid specifying this parameter for requests that target data streams with backing indexes across multiple data tiers. If set to `0` (default), the query does not terminate early.
 * @param {string} [params.timeout] - Specifies the period of time to wait for a response from each shard. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {boolean} [params.track_scores] - If `true`, calculate and return document scores, even if the scores are not used for sorting.
 * @param {string} [params.track_total_hits] - Number of hits matching the query to count accurately. If `true`, the exact number of hits is returned at the cost of some performance. If `false`, the response does not include the total number of hits matching the query.
 * @param {boolean} [params.typed_keys] - If `true`, aggregation and suggester names are be prefixed by their respective types in the response.
 * @param {boolean} [params.version] - If `true`, returns document version as part of a hit.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases to search. Supports wildcards (`*`). To search all data streams and indexes, omit this parameter or use `*` or `_all`.
 * @param {object} [params.body] - The search definition using the Query DSL
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function searchFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_search'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = searchFunc;
