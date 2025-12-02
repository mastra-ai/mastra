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
 * Returns information about nodes in the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/nodes-apis/nodes-info/ - nodes.info}
 *
 * @memberOf API-Nodes
 *
 * @param {object} [params]
 * @param {boolean} [params.flat_settings=false] - If `true`, returns settings in flat format.
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {array} [params.metric] - Limits the information returned to the specific metrics. Supports a comma-separated list, such as `http,ingest`.
 * @param {string} [params.node_id] - Comma-separated list of node IDs or names used to limit returned information.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function infoFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, metric, node_id, ...querystring } = params;
  metric = parsePathParam(metric);
  node_id = parsePathParam(node_id);

  const path = ['/_nodes', node_id, metric].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = infoFunc;
