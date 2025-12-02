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
 * Adds a block to an index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.add_block}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {boolean} [params.allow_no_indices] - Whether to ignore if a wildcard indexes expression resolves into no concrete indexes. (This includes `_all` string or when no indexes have been specified).
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.expand_wildcards] - Whether to expand wildcard expression to concrete indexes that are open, closed or both.
 * @param {boolean} [params.ignore_unavailable] - Whether specified concrete indexes should be ignored when unavailable (missing or closed).
 * @param {string} [params.master_timeout] DEPRECATED - Specify timeout for connection to cluster manager.
 * @param {string} [params.timeout] - Explicit operation timeout
 * @param {string} params.block - The block to add (one of `read`, `write`, `read_only` or `metadata`).
 * @param {string} params.index - A comma separated list of indexes to add a block to.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function addBlockFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.block == null) return handleMissingParam('block', this, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);

  let { body, block, index, ...querystring } = params;
  block = parsePathParam(block);
  index = parsePathParam(index);

  const path = '/' + index + '/_block/' + block;
  const method = 'PUT';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = addBlockFunc;
