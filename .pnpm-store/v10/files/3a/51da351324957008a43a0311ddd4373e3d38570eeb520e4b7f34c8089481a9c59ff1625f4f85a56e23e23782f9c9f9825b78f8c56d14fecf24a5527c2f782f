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
 * Returns basic information about the health of the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-health/ - cluster.health}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {string} [params.awareness_attribute] - The name of the awareness attribute for which to return the cluster health status (for example, `zone`). Applicable only if `level` is set to `awareness_attributes`.
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.expand_wildcards] - Specifies the type of index that wildcard expressions can match. Supports comma-separated values.
 * @param {string} [params.level] - Controls the amount of detail included in the cluster health response.
 * @param {boolean} [params.local=false] - Whether to return information from the local node only instead of from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {string} [params.timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.wait_for_active_shards] - Waits until the specified number of shards is active before returning a response. Use `all` for all shards.
 * @param {string} [params.wait_for_events] - Waits until all currently queued events with the given priority are processed.
 * @param {boolean} [params.wait_for_no_initializing_shards=false] - Whether to wait until there are no initializing shards in the cluster.
 * @param {boolean} [params.wait_for_no_relocating_shards=false] - Whether to wait until there are no relocating shards in the cluster.
 * @param {string} [params.wait_for_nodes] - Waits until the specified number of nodes (`N`) is available. Accepts `>=N`, `<=N`, `>N`, and `<N`. You can also use `ge(N)`, `le(N)`, `gt(N)`, and `lt(N)` notation.
 * @param {string} [params.wait_for_status] - Waits until the cluster health reaches the specified status or better.
 * @param {string} [params.index] - A comma-separated list of data streams, indexes, and aliases used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function healthFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['/_cluster/health', index].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = healthFunc;
