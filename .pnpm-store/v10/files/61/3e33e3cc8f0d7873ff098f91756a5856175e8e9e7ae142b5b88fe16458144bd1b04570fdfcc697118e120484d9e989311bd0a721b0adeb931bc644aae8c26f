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
 * Explicitly clears the search context for a scroll.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/scroll/ - clear_scroll}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {string} [params.scroll_id] DEPRECATED - Comma-separated list of scroll IDs to clear. To clear all scroll IDs, use `_all`.
 * @param {object} [params.body] - Comma-separated list of scroll IDs to clear if none was specified using the `scroll_id` parameter
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function clearScrollFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, scroll_id, ...querystring } = params;
  scroll_id = parsePathParam(scroll_id);

  const path = ['/_search/scroll', scroll_id].filter(c => c != null).join('/');
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = clearScrollFunc;
