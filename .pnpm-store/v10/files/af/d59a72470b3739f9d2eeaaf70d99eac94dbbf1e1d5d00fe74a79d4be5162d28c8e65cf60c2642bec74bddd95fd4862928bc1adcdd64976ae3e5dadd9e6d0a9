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
 * Updates an alias to point to a new index when the existing index
is considered to be too large or too old.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/dashboards/im-dashboards/rollover/ - indices.rollover}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {boolean} [params.dry_run=false] - If `true`, checks whether the current index satisfies the specified conditions but does not perform a rollover.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to all or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {string} params.alias - Name of the data stream or index alias to roll over.
 * @param {string} [params.new_index] - Name of the index to create. Supports date math. Data streams do not support this parameter.
 * @param {object} [params.body] - The conditions that needs to be met for executing rollover
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function rolloverFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.alias == null) return handleMissingParam('alias', this, callback);

  let { body, alias, new_index, ...querystring } = params;
  alias = parsePathParam(alias);
  new_index = parsePathParam(new_index);

  const path = ['', alias, '_rollover', new_index].filter(c => c != null).join('/');
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = rolloverFunc;
