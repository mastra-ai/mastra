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
 * Allows to perform multiple index/update/delete operations using request response streaming.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/document-apis/bulk-streaming/ - bulk_stream}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params._source] - `true` or `false` to return the `_source` field or not, or a list of fields to return.
 * @param {string} [params._source_excludes] - A comma-separated list of source fields to exclude from the response.
 * @param {string} [params._source_includes] - A comma-separated list of source fields to include in the response.
 * @param {string} [params.batch_interval] - Specifies for how long bulk operations should be accumulated into a batch before sending the batch to data nodes.
 * @param {number} [params.batch_size] - Specifies how many bulk operations should be accumulated into a batch before sending the batch to data nodes.
 * @param {string} [params.pipeline] - ID of the pipeline to use to preprocess incoming documents. If the index has a default ingest pipeline specified, then setting the value to `_none` disables the default ingest pipeline for this request. If a final pipeline is configured it will always run, regardless of the value of this parameter.
 * @param {string} [params.refresh] - If `true`, OpenSearch refreshes the affected shards to make this operation visible to search, if `wait_for` then wait for a refresh to make this operation visible to search, if `false` do nothing with refreshes. Valid values: `true`, `false`, `wait_for`.
 * @param {boolean} [params.require_alias=false] - If `true`, the request's actions must target an index alias.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.timeout] - Period each action waits for the following operations: automatic index creation, dynamic mapping updates, waiting for active shards.
 * @param {string} [params.type] - Default document type for items which don't provide one.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to all or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {string} [params.index] - Name of the data stream, index, or index alias to perform bulk actions on.
 * @param {array} params.body - The operation definition and data (action-data pairs), separated by newlines
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function bulkStreamFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_bulk/stream'].filter(c => c != null).join('/');
  const method = index == null ? 'POST' : 'PUT';

  return this.transport.request({ method, path, querystring, bulkBody: body }, options, callback);
}

module.exports = bulkStreamFunc;
