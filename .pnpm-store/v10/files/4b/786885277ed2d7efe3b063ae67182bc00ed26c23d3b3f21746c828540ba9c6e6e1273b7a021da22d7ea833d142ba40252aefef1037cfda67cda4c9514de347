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
 * Creates a snapshot repository.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/snapshots/create-repository/ - snapshot.create_repository}
 *
 * @memberOf API-Snapshot
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.master_timeout] DEPRECATED - Explicit operation timeout for connection to cluster-manager node
 * @param {string} [params.timeout] - The amount of time to wait for a response.
 * @param {boolean} [params.verify] - When `true`, verifies the creation of the snapshot repository.
 * @param {string} params.repository - The name for the newly registered repository.
 * @param {object} params.body - The repository definition.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function createRepositoryFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.repository == null) return handleMissingParam('repository', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, repository, ...querystring } = params;
  repository = parsePathParam(repository);

  const path = '/_snapshot/' + repository;
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = createRepositoryFunc;
