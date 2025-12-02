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
 * Provides a snapshot of how many shards are allocated to each data node and how much disk space they are using.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-allocation/ - cat.allocation}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.bytes] - The units used to display byte values.
 * @param {string} [params.cluster_manager_timeout] - A timeout for connection to the cluster manager node.
 * @param {string} [params.format] - A short version of the HTTP `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.local=false] - Returns local information but does not retrieve the state from cluster-manager node.
 * @param {string} [params.master_timeout] DEPRECATED - A timeout for connection to the cluster manager node.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 * @param {string} [params.node_id] - A comma-separated list of node IDs or names used to limit the returned information.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function allocationFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, node_id, ...querystring } = params;
  node_id = parsePathParam(node_id);

  const path = ['/_cat/allocation', node_id].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = allocationFunc;
