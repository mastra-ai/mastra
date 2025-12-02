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
 * Retrieves a specific snapshot management policy by name.
 * <br/> See Also: {@link undefined - sm.get_policy}
 *
 * @memberOf API-Sm
 *
 * @param {object} params
 * @param {string} params.policy_name - The name of the snapshot management policy to retrieve.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getPolicyFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.policy_name == null) return handleMissingParam('policy_name', this, callback);

  let { body, policy_name, ...querystring } = params;
  policy_name = parsePathParam(policy_name);

  const path = '/_plugins/_sm/policies/' + policy_name;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getPolicyFunc;
