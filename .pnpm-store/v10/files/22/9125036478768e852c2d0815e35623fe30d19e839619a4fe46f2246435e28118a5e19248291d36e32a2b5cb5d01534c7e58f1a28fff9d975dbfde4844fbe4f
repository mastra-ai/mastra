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
 * Allows to get multiple documents in one request.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/document-apis/multi-get/ - mget}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params._source] - Set to `true` or `false` to return the `_source` field or not, or a list of fields to return.
 * @param {string} [params._source_excludes] - A comma-separated list of source fields to exclude from the response. You can also use this parameter to exclude fields from the subset specified in `_source_includes` query parameter.
 * @param {string} [params._source_includes] - A comma-separated list of source fields to include in the response. If this parameter is specified, only these source fields are returned. You can exclude fields from this subset using the `_source_excludes` query parameter. If the `_source` parameter is `false`, this parameter is ignored.
 * @param {string} [params.preference=random] - Specifies the node or shard the operation should be performed on. Random by default.
 * @param {boolean} [params.realtime] - If `true`, the request is real-time as opposed to near-real-time.
 * @param {string} [params.refresh] - If `true`, the request refreshes relevant shards before retrieving documents.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.stored_fields] - If `true`, retrieves the document fields stored in the index rather than the document `_source`.
 * @param {string} [params.index] - Name of the index to retrieve documents from when `ids` are specified, or when a document in the `docs` array does not specify an index.
 * @param {object} params.body - Document identifiers; can be either `docs` (containing full document information) or `ids` (when index is provided in the URL.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function mgetFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_mget'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = mgetFunc;
