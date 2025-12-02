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
 * Trains a model synchronously.
 * <br/> See Also: {@link undefined - ml.train}
 *
 * @memberOf API-Ml
 *
 * @param {object} params
 * @param {string} params.algorithm_name 
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function trainFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.algorithm_name == null) return handleMissingParam('algorithm_name', this, callback);

  let { body, algorithm_name, ...querystring } = params;
  algorithm_name = parsePathParam(algorithm_name);

  const path = '/_plugins/_ml/_train/' + algorithm_name;
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = trainFunc;
