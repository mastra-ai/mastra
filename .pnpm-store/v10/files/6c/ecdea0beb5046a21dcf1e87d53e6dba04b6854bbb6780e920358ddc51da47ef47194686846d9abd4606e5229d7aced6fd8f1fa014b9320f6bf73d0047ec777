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

const { normalizeArguments, handleMissingParam } = require('../utils');

/**
 * Gets the policies.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/ism/api/#create-policy - ism.put_policies}
 *
 * @memberOf API-Ism
 *
 * @param {object} params
 * @param {number} [params.if_primary_term] - Only perform the operation if the document has this primary term.
 * @param {number} [params.if_seq_no] - Only perform the operation if the document has this sequence number.
 * @param {string} params.policyID 
 * @param {string} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putPoliciesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.policyID == null) return handleMissingParam('policyID', this, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_ism/policies';
  const method = 'PUT';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putPoliciesFunc;
