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
 * Returns low-level information about REST actions usage on nodes.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - nodes.usage}
 *
 * @memberOf API-Nodes
 *
 * @param {object} [params]
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.node_id] - A comma-separated list of node IDs or names to limit the returned information; use `_local` to return information from the node you're connecting to, leave empty to get information from all nodes
 * @param {array} [params.metric] - Limits the information returned to the specific metrics. A comma-separated list of the following options: `_all`, `rest_actions`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function usageFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, node_id, metric, ...querystring } = params;
  node_id = parsePathParam(node_id);
  metric = parsePathParam(metric);

  const path = ['/_nodes', node_id, 'usage', metric].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = usageFunc;
