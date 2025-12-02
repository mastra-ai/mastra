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
 * Allows to manually change the allocation of individual shards in the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - cluster.reroute}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {boolean} [params.dry_run] - When `true`, the request simulates the operation and returns the resulting state.
 * @param {boolean} [params.explain] - When `true`, the response contains an explanation of why reroute certain commands can or cannot be executed.
 * @param {string} [params.master_timeout] DEPRECATED - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {string} [params.metric] - Limits the information returned to the specified metrics.
 * @param {boolean} [params.retry_failed] - When `true`, retries shard allocation if it was blocked because of too many subsequent failures.
 * @param {string} [params.timeout] - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {object} [params.body] - The definition of `commands` to perform (`move`, `cancel`, `allocate`)
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function rerouteFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cluster/reroute';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = rerouteFunc;
