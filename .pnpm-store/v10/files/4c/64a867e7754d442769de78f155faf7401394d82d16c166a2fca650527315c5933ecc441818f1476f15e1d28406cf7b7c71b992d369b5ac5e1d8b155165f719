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
 * Allows to retrieve a large numbers of results from a single search request.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/scroll/#path-and-http-methods - scroll}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {boolean} [params.rest_total_hits_as_int=false] - If `true`, the API response's `hit.total` property is returned as an integer. If `false`, the API response's `hit.total` property is returned as an object.
 * @param {string} [params.scroll] - Period to retain the search context for scrolling.
 * @param {string} [params.scroll_id] DEPRECATED - The scroll ID
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function scrollFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, scroll_id, ...querystring } = params;
  scroll_id = parsePathParam(scroll_id);

  const path = ['/_search/scroll', scroll_id].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = scrollFunc;
