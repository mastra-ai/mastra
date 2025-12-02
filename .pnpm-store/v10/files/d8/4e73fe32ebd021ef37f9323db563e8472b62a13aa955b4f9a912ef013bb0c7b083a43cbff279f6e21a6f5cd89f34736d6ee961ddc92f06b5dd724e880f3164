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

const { normalizeArguments, parsePathParam } = require('../utils');

/**
 * Performs the analysis process on a text and return the tokens breakdown of the text.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/analyze-apis/perform-text-analysis/ - indices.analyze}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {string} [params.index] - Index used to derive the analyzer. If specified, the `analyzer` or field parameter overrides this value. If no index is specified or the index does not have a default analyzer, the analyze API uses the standard analyzer.
 * @param {object} [params.body] - Define analyzer/tokenizer parameters and the text on which the analysis should be performed
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function analyzeFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_analyze'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = analyzeFunc;
