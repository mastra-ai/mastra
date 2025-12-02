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
 * Fetches weighted shard routing weights.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-awareness/#example-getting-weights-for-all-zones - cluster.get_weighted_routing}
 *
 * @memberOf API-Cluster
 *
 * @param {object} params
 * @param {string} params.attribute - The name of the awareness attribute.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getWeightedRoutingFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.attribute == null) return handleMissingParam('attribute', this, callback);

  let { body, attribute, ...querystring } = params;
  attribute = parsePathParam(attribute);

  const path = '/_cluster/routing/awareness/' + attribute + '/weights';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getWeightedRoutingFunc;
