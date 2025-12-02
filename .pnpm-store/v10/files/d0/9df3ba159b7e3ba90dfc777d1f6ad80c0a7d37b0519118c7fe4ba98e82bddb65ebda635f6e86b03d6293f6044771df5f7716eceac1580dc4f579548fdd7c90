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
 * Creates or replaces the specified search pipeline.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/search-pipelines/creating-search-pipeline/ - search_pipeline.put}
 *
 * @memberOf API-Search-Pipeline
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - operation timeout for connection to cluster-manager node.
 * @param {string} [params.timeout] - Operation timeout.
 * @param {string} params.id - Pipeline ID.
 * @param {object} params.body 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, id, ...querystring } = params;
  id = parsePathParam(id);

  const path = '/_search/pipeline/' + id;
  const method = 'PUT';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putFunc;
