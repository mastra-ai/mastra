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
 * Explains how shards are allocated in the current cluster and provides an explanation for why unassigned shards can't be allocated to a node.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-allocation/ - cluster.allocation_explain}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {boolean} [params.include_disk_info=false] - When `true`, returns information about disk usage and shard sizes.
 * @param {boolean} [params.include_yes_decisions=false] - When `true`, returns any `YES` decisions in the allocation explanation. `YES` decisions indicate when a particular shard allocation attempt was successful for the given node.
 * @param {object} [params.body] - The index, shard, and primary flag for which to generate an explanation. Leave this empty to generate an explanation for the first unassigned shard.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function allocationExplainFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cluster/allocation/explain';
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = allocationExplainFunc;
