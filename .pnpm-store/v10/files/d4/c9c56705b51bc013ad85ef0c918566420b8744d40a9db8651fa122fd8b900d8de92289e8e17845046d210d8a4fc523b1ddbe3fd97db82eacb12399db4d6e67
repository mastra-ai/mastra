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
 * Updates a document with a script or partial document.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/document-apis/update-document/ - update}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params._source] - Set to `false` to disable source retrieval. You can also specify a comma-separated list of the fields you want to retrieve.
 * @param {string} [params._source_excludes] - Specify the source fields you want to exclude.
 * @param {string} [params._source_includes] - Specify the source fields you want to retrieve.
 * @param {number} [params.if_primary_term] - Only perform the operation if the document has this primary term.
 * @param {number} [params.if_seq_no] - Only perform the operation if the document has this sequence number.
 * @param {string} [params.lang=painless] - The script language.
 * @param {string} [params.refresh] - If 'true', OpenSearch refreshes the affected shards to make this operation visible to search, if `wait_for` then wait for a refresh to make this operation visible to search, if `false` do nothing with refreshes.
 * @param {boolean} [params.require_alias=false] - If `true`, the destination must be an index alias.
 * @param {number} [params.retry_on_conflict=0] - Specify how many times should the operation be retried when a conflict occurs.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.timeout] - Period to wait for dynamic mapping updates and active shards. This guarantees OpenSearch waits for at least the timeout before failing. The actual wait time could be longer, particularly when multiple waits occur.
 * @param {string} [params.wait_for_active_shards] - The number of shard copies that must be active before proceeding with the operations. Set to 'all' or any positive integer up to the total number of shards in the index (number_of_replicas+1). Defaults to 1 meaning the primary shard.
 * @param {string} params.id - Document ID
 * @param {string} params.index - The name of the index
 * @param {object} params.body - The request definition requires either `script` or partial `doc`
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function updateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, id, index, ...querystring } = params;
  id = parsePathParam(id);
  index = parsePathParam(index);

  const path = '/' + index + '/_update/' + id;
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = updateFunc;
