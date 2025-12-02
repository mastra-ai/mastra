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
 * Get tools.
 * <br/> See Also: {@link undefined - ml.get_tool}
 *
 * @memberOf API-Ml
 *
 * @param {object} params
 * @param {string} params.tool_name 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getToolFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.tool_name == null) return handleMissingParam('tool_name', this, callback);

  let { body, tool_name, ...querystring } = params;
  tool_name = parsePathParam(tool_name);

  const path = '/_plugins/_ml/tools/' + tool_name;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getToolFunc;
