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

const { normalizeArguments, handleMissingParam } = require('../utils');

/**
 * Shows how a query is executed against OpenSearch.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/sql/sql-ppl-api/ - ppl.explain}
 *
 * @memberOf API-Ppl
 *
 * @param {object} params
 * @param {string} [params.format] - A short version of the Accept header (for example, `json`, `yaml`).
 * @param {boolean} [params.sanitize=true] - Specifies whether to escape special characters in the results.
 * @param {object} params.body 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function explainFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_ppl/_explain';
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = explainFunc;
