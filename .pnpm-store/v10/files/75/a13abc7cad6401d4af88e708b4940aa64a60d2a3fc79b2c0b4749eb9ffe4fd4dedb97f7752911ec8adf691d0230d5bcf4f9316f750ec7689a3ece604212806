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
 * Retrieves the decommission status for all zones.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-decommission/#example-getting-zone-decommission-status - cluster.get_decommission_awareness}
 *
 * @memberOf API-Cluster
 *
 * @param {object} params
 * @param {string} params.awareness_attribute_name - The name of the awareness attribute.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getDecommissionAwarenessFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.awareness_attribute_name == null) return handleMissingParam('awareness_attribute_name', this, callback);

  let { body, awareness_attribute_name, ...querystring } = params;
  awareness_attribute_name = parsePathParam(awareness_attribute_name);

  const path = '/_cluster/decommission/awareness/' + awareness_attribute_name + '/_status';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getDecommissionAwarenessFunc;
