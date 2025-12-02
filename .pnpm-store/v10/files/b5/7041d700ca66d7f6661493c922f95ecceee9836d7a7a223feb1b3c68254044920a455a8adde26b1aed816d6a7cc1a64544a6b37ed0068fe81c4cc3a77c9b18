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
 * Performs the force merge operation on one or more indexes.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.forcemerge}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {boolean} [params.allow_no_indices] - Whether to ignore if a wildcard indexes expression resolves into no concrete indexes. (This includes `_all` string or when no indexes have been specified)
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {boolean} [params.flush=true] - Specify whether the index should be flushed after performing the operation.
 * @param {boolean} [params.ignore_unavailable] - Whether specified concrete indexes should be ignored when unavailable (missing or closed)
 * @param {number} [params.max_num_segments] - The number of larger segments into which smaller segments are merged. Set this parameter to 1 to merge all segments into one segment. The default behavior is to perform the merge as necessary.
 * @param {boolean} [params.only_expunge_deletes] - Specify whether the operation should only expunge deleted documents
 * @param {boolean} [params.primary_only=false] - Specify whether the operation should only perform on primary shards. Defaults to false.
 * @param {boolean} [params.wait_for_completion=true] - Should the request wait until the force merge is completed.
 * @param {string} [params.index] - A comma-separated list of index names; use `_all` or empty string to perform the operation on all indexes
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function forcemergeFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_forcemerge'].filter(c => c != null).join('/');
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = forcemergeFunc;
