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
 * Decommissions a cluster zone based on awareness. This can greatly benefit multi-zone deployments, where awareness attributes can aid in applying new upgrades to a cluster in a controlled fashion.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-decommission/#example-decommissioning-and-recommissioning-a-zone - cluster.put_decommission_awareness}
 *
 * @memberOf API-Cluster
 *
 * @param {object} params
 * @param {string} params.awareness_attribute_name - The name of the awareness attribute.
 * @param {string} params.awareness_attribute_value - The value of the awareness attribute. For example, if you have shards allocated in two different zones, you can give each zone a value of `zone-a` or `zoneb`. The cluster decommission operation decommissions the zone listed in the method.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putDecommissionAwarenessFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.awareness_attribute_name == null) return handleMissingParam('awareness_attribute_name', this, callback);
  if (params.awareness_attribute_value == null) return handleMissingParam('awareness_attribute_value', this, callback);

  let { body, awareness_attribute_name, awareness_attribute_value, ...querystring } = params;
  awareness_attribute_name = parsePathParam(awareness_attribute_name);
  awareness_attribute_value = parsePathParam(awareness_attribute_value);

  const path = '/_cluster/decommission/awareness/' + awareness_attribute_name + '/' + awareness_attribute_value;
  const method = 'PUT';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putDecommissionAwarenessFunc;
