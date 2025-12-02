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
 * Returns information about whether a particular alias exists.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.exists_alias}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {boolean} [params.ignore_unavailable] - If `false`, requests that include a missing data stream or index in the target indexes or data streams return an error.
 * @param {boolean} [params.local=false] - If `true`, the request retrieves information from the local node only.
 * @param {string} params.name - Comma-separated list of aliases to check. Supports wildcards (`*`).
 * @param {string} [params.index] - Comma-separated list of data streams or indexes used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function existsAliasFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);

  let { body, name, index, ...querystring } = params;
  name = parsePathParam(name);
  index = parsePathParam(index);

  const path = ['', index, '_alias', name].filter(c => c != null).join('/');
  const method = 'HEAD';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = existsAliasFunc;
