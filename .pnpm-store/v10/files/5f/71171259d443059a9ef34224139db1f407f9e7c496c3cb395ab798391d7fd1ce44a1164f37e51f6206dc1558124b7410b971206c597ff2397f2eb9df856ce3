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
 * Clones an index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/index-apis/clone/ - indices.clone}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.task_execution_timeout] - Explicit task execution timeout, only useful when `wait_for_completion` is false, defaults to `1h`.
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to `all` or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {boolean} [params.wait_for_completion=true] - Should this request wait until the operation has completed before returning.
 * @param {string} params.index - Name of the source index to clone.
 * @param {string} params.target - Name of the target index to create.
 * @param {object} [params.body] - The configuration for the target index (`settings` and `aliases`)
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function cloneFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);
  if (params.target == null) return handleMissingParam('target', this, callback);

  let { body, index, target, ...querystring } = params;
  index = parsePathParam(index);
  target = parsePathParam(target);

  const path = '/' + index + '/_clone/' + target;
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = cloneFunc;
