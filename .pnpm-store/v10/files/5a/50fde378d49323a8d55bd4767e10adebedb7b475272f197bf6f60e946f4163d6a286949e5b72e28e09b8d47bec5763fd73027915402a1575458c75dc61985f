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
 * Returns statistical information about nodes in the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/nodes-apis/nodes-usage/ - nodes.stats}
 *
 * @memberOf API-Nodes
 *
 * @param {object} [params]
 * @param {string} [params.completion_fields] - Comma-separated list or wildcard expressions of fields to include in field data and suggest statistics.
 * @param {string} [params.fielddata_fields] - Comma-separated list or wildcard expressions of fields to include in field data statistics.
 * @param {string} [params.fields] - Comma-separated list or wildcard expressions of fields to include in the statistics.
 * @param {array} [params.groups] - Comma-separated list of search groups to include in the search statistics.
 * @param {boolean} [params.include_segment_file_sizes=false] - If `true`, the call reports the aggregated disk usage of each one of the Lucene index files (only applies if segment stats are requested).
 * @param {string} [params.level] - Indicates whether statistics are aggregated at the cluster, index, or shard level.
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {array} [params.types] - A comma-separated list of document types for the indexing index metric.
 * @param {string} [params.node_id] - Comma-separated list of node IDs or names used to limit returned information.
 * @param {array} [params.metric] - Limit the information returned to the specified metrics
 * @param {array} [params.index_metric] - Limit the information returned for indexes metric to the specific index metrics. It can be used only if indexes (or all) metric is specified.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function statsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, node_id, metric, index_metric, ...querystring } = params;
  node_id = parsePathParam(node_id);
  metric = parsePathParam(metric);
  index_metric = parsePathParam(index_metric);

  const path = ['/_nodes', node_id, 'stats', metric, index_metric].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = statsFunc;
