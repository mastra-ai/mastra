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
 * Returns comprehensive information about the state of the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - cluster.state}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {boolean} [params.allow_no_indices] - Whether to ignore a wildcard index expression that resolves into no concrete indexes. This includes the `_all` string or when no indexes have been specified.
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.expand_wildcards] - Specifies the type of index that wildcard expressions can match. Supports comma-separated values.
 * @param {boolean} [params.flat_settings=false] - Whether to return settings in the flat form, which can improve readability, especially for heavily nested settings. For example, the flat form of `"cluster": { "max_shards_per_node": 500 }` is `"cluster.max_shards_per_node": "500"`.
 * @param {boolean} [params.ignore_unavailable] - Whether the specified concrete indexes should be ignored when unavailable (missing or closed).
 * @param {boolean} [params.local=false] - Whether to return information from the local node only instead of from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {number} [params.wait_for_metadata_version] - Wait for the metadata version to be equal or greater than the specified metadata version.
 * @param {string} [params.wait_for_timeout] - The maximum time to wait for `wait_for_metadata_version` before timing out.
 * @param {array} [params.metric] - Limits the information returned to only the [specified metric groups](https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-stats/#metric-groups).
 * @param {string} [params.index] - A comma-separated list of data streams, indexes, and aliases used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function stateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, metric, index, ...querystring } = params;
  metric = parsePathParam(metric);
  index = parsePathParam(index);

  const path = ['/_cluster/state', metric, index].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = stateFunc;
