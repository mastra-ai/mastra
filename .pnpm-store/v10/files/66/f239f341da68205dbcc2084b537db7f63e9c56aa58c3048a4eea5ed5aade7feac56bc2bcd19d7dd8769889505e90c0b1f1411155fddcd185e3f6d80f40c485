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
 * Deletes the specified dangling index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/index-apis/dangling-index/ - dangling_indices.delete_dangling_index}
 *
 * @memberOf API-Dangling-Indices
 *
 * @param {object} params
 * @param {boolean} params.accept_data_loss - Must be set to true in order to delete the dangling index.
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.master_timeout] DEPRECATED - Specify timeout for connection to cluster manager.
 * @param {string} [params.timeout] - Explicit operation timeout.
 * @param {string} params.index_uuid - The UUID of the dangling index.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function deleteDanglingIndexFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.accept_data_loss == null) return handleMissingParam('accept_data_loss', this, callback);
  if (params.index_uuid == null) return handleMissingParam('index_uuid', this, callback);

  let { body, index_uuid, ...querystring } = params;
  index_uuid = parsePathParam(index_uuid);

  const path = '/_dangling/' + index_uuid;
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = deleteDanglingIndexFunc;
