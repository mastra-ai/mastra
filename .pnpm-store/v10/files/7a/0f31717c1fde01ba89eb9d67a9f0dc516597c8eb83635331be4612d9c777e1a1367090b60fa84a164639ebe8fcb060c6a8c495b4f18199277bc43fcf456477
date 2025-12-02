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
 * Creates a new document in the index.

Returns a 409 response when a document with a same ID already exists in the index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/document-apis/index-document/ - create}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params.pipeline] - ID of the pipeline to use to preprocess incoming documents. If the index has a default ingest pipeline specified, then setting the value to `_none` disables the default ingest pipeline for this request. If a final pipeline is configured it will always run, regardless of the value of this parameter.
 * @param {string} [params.refresh] - If `true`, OpenSearch refreshes the affected shards to make this operation visible to search, if `wait_for` then wait for a refresh to make this operation visible to search, if `false` do nothing with refreshes. Valid values: `true`, `false`, `wait_for`.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.timeout] - Period the request waits for the following operations: automatic index creation, dynamic mapping updates, waiting for active shards.
 * @param {number} [params.version] - Explicit version number for concurrency control. The specified version must match the current version of the document for the request to succeed.
 * @param {string} [params.version_type] - Specific version type: `external`, `external_gte`.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operation. Set to `all` or any positive integer up to the total number of shards in the index (`number_of_replicas+1`).
 * @param {string} params.id - Unique identifier for the document.
 * @param {string} params.index - Name of the data stream or index to target. If the target doesn't exist and matches the name or wildcard (`*`) pattern of an index template with a `data_stream` definition, this request creates the data stream. If the target doesn't exist and doesn't match a data stream template, this request creates the index.
 * @param {object} params.body - The document
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function createFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, id, index, ...querystring } = params;
  id = parsePathParam(id);
  index = parsePathParam(index);

  const path = '/' + index + '/_create/' + id;
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = createFunc;
