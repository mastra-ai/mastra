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
 * Adds SQL settings to the standard OpenSearch cluster settings.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/sql/settings/ - sql.settings}
 *
 * @memberOf API-Sql
 *
 * @param {object} [params]
 * @param {string} [params.format] - A short version of the Accept header (for example, `json`, `yaml`).
 * @param {string} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function settingsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_query/settings';
  const method = 'PUT';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = settingsFunc;
