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
 * Refresh search analyzers in real time.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/refresh-analyzer/ - ism.refresh_search_analyzers}
 *
 * @memberOf API-Ism
 *
 * @param {object} params
 * @param {string} params.index - Comma-separated list of data streams, indexes, and aliases. Supports wildcards (`*`).
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function refreshSearchAnalyzersFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = '/_plugins/_refresh_search_analyzers/' + index;
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = refreshSearchAnalyzersFunc;
