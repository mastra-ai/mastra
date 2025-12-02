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
 * Get all memories.
 * <br/> See Also: {@link undefined - ml.get_all_memories}
 *
 * @memberOf API-Ml
 *
 * @param {object} [params]
 * @param {number} [params.max_results] - The maximum number of results to return. If there are fewer memories than the number set in `max_results`, the response returns only the number of memories that exist. Default is `10`.
 * @param {number} [params.next_token] - The index of the first memory in the sorted list of memories to return. Memories are ordered by `create_time`. For example, if memories `A`, `B`, and `C` exist, `next_token=1` returns memories `B` and `C`. Default is `0` (return all memories).
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getAllMemoriesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_ml/memory';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getAllMemoriesFunc;
