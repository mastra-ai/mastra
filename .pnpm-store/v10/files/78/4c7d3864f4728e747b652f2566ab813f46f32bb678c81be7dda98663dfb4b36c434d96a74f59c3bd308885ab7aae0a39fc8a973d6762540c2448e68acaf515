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
 * The `_upgrade` API is no longer useful and will be removed.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.get_upgrade}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {boolean} [params.allow_no_indices] - Whether to ignore if a wildcard indexes expression resolves into no concrete indexes. (This includes `_all` string or when no indexes have been specified).
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {boolean} [params.ignore_unavailable] - Whether specified concrete indexes should be ignored when unavailable (missing or closed).
 * @param {array} [params.index] - Comma-separated list of indexes; use `_all` or empty string to perform the operation on all indexes.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getUpgradeFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_upgrade'].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getUpgradeFunc;
