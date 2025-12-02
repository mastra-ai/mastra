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
 * Collect metrics for the plugin within the interval.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/sql/monitoring/ - sql.get_stats}
 *
 * @memberOf API-Sql
 *
 * @param {object} [params]
 * @param {string} [params.format] - A short version of the Accept header (for example, `json`, `yaml`).
 * @param {boolean} [params.sanitize=true] - Specifies whether to escape special characters in the results
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getStatsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_sql/stats';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getStatsFunc;
