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
 * Uploads model chunk.
 * <br/> See Also: {@link undefined - ml.chunk_model}
 *
 * @memberOf API-Ml
 *
 * @param {object} params
 * @param {number} params.chunk_number 
 * @param {string} params.model_id 
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function chunkModelFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.chunk_number == null) return handleMissingParam('chunk_number', this, callback);
  if (params.model_id == null) return handleMissingParam('model_id', this, callback);

  let { body, chunk_number, model_id, ...querystring } = params;
  chunk_number = parsePathParam(chunk_number);
  model_id = parsePathParam(model_id);

  const path = '/_plugins/_ml/models/' + model_id + '/chunk/' + chunk_number;
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = chunkModelFunc;
