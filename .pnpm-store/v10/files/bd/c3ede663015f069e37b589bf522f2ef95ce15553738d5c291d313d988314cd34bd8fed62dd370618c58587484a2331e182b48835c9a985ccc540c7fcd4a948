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
 * Returns a high-level overview of cluster statistics.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-stats/ - cluster.stats}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {boolean} [params.flat_settings=false] - Whether to return settings in the flat form, which can improve readability, especially for heavily nested settings. For example, the flat form of `"cluster": { "max_shards_per_node": 500 }` is `"cluster.max_shards_per_node": "500"`.
 * @param {string} [params.timeout] - The amount of time to wait for each node to respond. If a node does not respond before its timeout expires, the response does not include its stats. However, timed out nodes are included in the response's `_nodes.failed` property. Defaults to no timeout.
 * @param {array} [params.index_metric] - A comma-separated list of [index metric groups](https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-stats/#index-metric-groups), for example, `docs,store`.
 * @param {array} [params.metric] - Limit the information returned to the specified metrics.
 * @param {string} [params.node_id] - A comma-separated list of node IDs used to filter results. Supports [node filters](https://opensearch.org/docs/latest/api-reference/nodes-apis/index/#node-filters).
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function statsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index_metric, metric, node_id, ...querystring } = params;
  index_metric = parsePathParam(index_metric);
  metric = parsePathParam(metric);
  node_id = parsePathParam(node_id);

  let path;
  if (metric != null && index_metric != null && node_id != null) {
    path = '/_cluster/stats/' + metric + '/' + index_metric + '/nodes/' + node_id;
  } else if (metric != null && node_id != null) {
    path = '/_cluster/stats/' + metric + '/nodes/' + node_id;
  } else if (node_id != null) {
    path = '/_cluster/stats/nodes/' + node_id;
  } else {
    path = '/_cluster/stats';
  }
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = statsFunc;
