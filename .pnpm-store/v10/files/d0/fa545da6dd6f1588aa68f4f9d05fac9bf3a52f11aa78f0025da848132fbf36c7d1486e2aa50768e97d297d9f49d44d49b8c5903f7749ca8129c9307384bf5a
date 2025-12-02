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
 * Returns a list of pending cluster-level tasks, such as index creation, mapping updates,
or new allocations.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - cluster.pending_tasks}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {boolean} [params.local=false] - When `true`, the request retrieves information from the local node only. When `false`, information is retrieved from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function pendingTasksFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cluster/pending_tasks';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = pendingTasksFunc;
