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
 * Allows to copy documents from one index to another, optionally filtering the source
documents by a query, changing the destination index settings, or fetching the
documents from a remote cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/reindex-data/ - reindex}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {number} [params.max_docs] - Maximum number of documents to process. By default, all documents.
 * @param {string} [params.refresh] - If `true`, the request refreshes affected shards to make this operation visible to search.
 * @param {number} [params.requests_per_second=0] - The throttle for this request in sub-requests per second. Defaults to no throttle.
 * @param {boolean} [params.require_alias] 
 * @param {string} [params.scroll] - Specifies how long a consistent view of the index should be maintained for scrolled search.
 * @param {string} [params.slices] - The number of slices this task should be divided into. Defaults to 1 slice, meaning the task isn't sliced into subtasks.
 * @param {string} [params.timeout] - Period each indexing waits for automatic index creation, dynamic mapping updates, and waiting for active shards.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to `all` or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {boolean} [params.wait_for_completion=true] - If `true`, the request blocks until the operation is complete.
 * @param {object} params.body - The search definition using the Query DSL and the prototype for the index request.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function reindexFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, ...querystring } = params;

  const path = '/_reindex';
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = reindexFunc;
