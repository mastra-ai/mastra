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
 * Deletes a component template.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - cluster.delete_component_template}
 *
 * @memberOf API-Cluster
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.master_timeout] DEPRECATED - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {string} [params.timeout] - A duration. Units can be `nanos`, `micros`, `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours) and `d` (days). Also accepts `0` without a unit and `-1` to indicate an unspecified value.
 * @param {string} params.name - The name of the component template to delete. Supports wildcard (*) expressions.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function deleteComponentTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_component_template/' + name;
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = deleteComponentTemplateFunc;
