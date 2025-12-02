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
 * Creates or updates a document in an index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/document-apis/index-document/ - index}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {number} [params.if_primary_term] - Only perform the operation if the document has this primary term.
 * @param {number} [params.if_seq_no] - Only perform the operation if the document has this sequence number.
 * @param {string} [params.op_type] - Set to create to only index the document if it does not already exist (put if absent). If a document with the specified `_id` already exists, the indexing operation will fail. Same as using the `<index>/_create` endpoint. Valid values: `index`, `create`. If document id is specified, it defaults to `index`. Otherwise, it defaults to `create`.
 * @param {string} [params.pipeline] - ID of the pipeline to use to preprocess incoming documents. If the index has a default ingest pipeline specified, then setting the value to `_none` disables the default ingest pipeline for this request. If a final pipeline is configured it will always run, regardless of the value of this parameter.
 * @param {string} [params.refresh] - If `true`, OpenSearch refreshes the affected shards to make this operation visible to search, if `wait_for` then wait for a refresh to make this operation visible to search, if `false` do nothing with refreshes. Valid values: `true`, `false`, `wait_for`.
 * @param {boolean} [params.require_alias=false] - If `true`, the destination must be an index alias.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.timeout] - Period the request waits for the following operations: automatic index creation, dynamic mapping updates, waiting for active shards.
 * @param {number} [params.version] - Explicit version number for concurrency control. The specified version must match the current version of the document for the request to succeed.
 * @param {string} [params.version_type] - Specific version type: `external`, `external_gte`.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to all or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {string} params.index - Name of the data stream or index to target.
 * @param {string} [params.id] - Unique identifier for the document.
 * @param {object} params.body - The document
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function indexFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, id, ...querystring } = params;
  index = parsePathParam(index);
  id = parsePathParam(id);

  const path = ['', index, '_doc', id].filter(c => c != null).join('/');
  const method = id == null ? 'POST' : 'PUT';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = indexFunc;
