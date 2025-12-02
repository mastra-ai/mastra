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

const { normalizeArguments } = require('../utils');

/**
 * Retrieves all snapshot management policies with optional pagination and filtering.
 * <br/> See Also: {@link undefined - sm.get_policies}
 *
 * @memberOf API-Sm
 *
 * @param {object} [params]
 * @param {number} [params.from=0] - The starting index from which to retrieve snapshot management policies.
 * @param {string} [params.queryString] - The query string to filter the returned snapshot management policies.
 * @param {number} [params.size] - The number of snapshot management policies to return.
 * @param {string} [params.sortField] - The name of the field to sort the snapshot management policies by.
 * @param {string} [params.sortOrder=asc] - The order to sort the snapshot management policies.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getPoliciesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_sm/policies';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getPoliciesFunc;
