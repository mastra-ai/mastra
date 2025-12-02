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
 * Returns information about whether a particular index exists.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/index-apis/exists/ - indices.exists}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {boolean} [params.allow_no_indices=false] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes.
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {boolean} [params.flat_settings=false] - If `true`, returns settings in flat format.
 * @param {boolean} [params.ignore_unavailable=false] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {boolean} [params.include_defaults=false] - If `true`, return all default settings in the response.
 * @param {boolean} [params.local=false] - If `true`, the request retrieves information from the local node only.
 * @param {string} params.index - Comma-separated list of data streams, indexes, and aliases. Supports wildcards (`*`).
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function existsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = '/' + index;
  const method = 'HEAD';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = existsFunc;
