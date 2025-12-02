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
 * Clears all or specific caches for one or more indexes.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/index-apis/clear-index-cache/ - indices.clear_cache}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {boolean} [params.allow_no_indices] - If `false`, the request returns an error if any wildcard expression, index alias, or `_all` value targets only missing or closed indexes. This behavior applies even if the request targets other open indexes.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {boolean} [params.fielddata] - If `true`, clears the fields cache. Use the `fields` parameter to clear the cache of specific fields only.
 * @param {string} [params.fields] - Comma-separated list of field names used to limit the `fielddata` parameter.
 * @param {boolean} [params.file=false] - If `true`, clears the unused entries from the file cache on nodes with the Search role.
 * @param {boolean} [params.ignore_unavailable] - If `false`, the request returns an error if it targets a missing or closed index.
 * @param {string} [params.index] - Comma-separated list of data streams, indexes, and aliases used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 * @param {boolean} [params.query] - If `true`, clears the query cache.
 * @param {boolean} [params.request] - If `true`, clears the request cache.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function clearCacheFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_cache/clear'].filter(c => c != null).join('/');
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = clearCacheFunc;
