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
 * Creates point in time context.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/point-in-time-api/#create-a-pit - create_pit}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {boolean} [params.allow_partial_pit_creation] - Allow if point in time can be created with partial failures.
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {string} [params.keep_alive] - Specify the keep alive for point in time.
 * @param {string} [params.preference=random] - Specify the node or shard the operation should be performed on.
 * @param {string} [params.routing] - Comma-separated list of specific routing values.
 * @param {array} params.index - Comma-separated list of indexes; use `_all` or empty string to perform the operation on all indexes.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function createPitFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = '/' + index + '/_search/point_in_time';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = createPitFunc;
