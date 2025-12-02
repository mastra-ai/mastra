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
 * Gets a policy.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/ism/api/#put-policy - ism.get_policy}
 *
 * @memberOf API-Ism
 *
 * @param {object} params
 * @param {string} params.policy_id 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getPolicyFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.policy_id == null) return handleMissingParam('policy_id', this, callback);

  let { body, policy_id, ...querystring } = params;
  policy_id = parsePathParam(policy_id);

  const path = '/_plugins/_ism/policies/' + policy_id;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getPolicyFunc;
