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
 * Returns the details of all transform jobs.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/index-transforms/transforms-apis/#get-a-transform-jobs-details - transforms.search}
 *
 * @memberOf API-Transforms
 *
 * @param {object} [params]
 * @param {number} [params.from] - The starting transform to return. Default is `0`.
 * @param {string} [params.search] - The search term to use to filter results.
 * @param {number} [params.size] - Specifies the number of transforms to return. Default is `10`.
 * @param {string} [params.sortDirection] - Specifies the direction to sort results in. Can be `ASC` or `DESC`. Default is `ASC`.
 * @param {string} [params.sortField] - The field to sort results with.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function searchFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_transform';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = searchFunc;
