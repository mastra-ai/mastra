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
 * Restores a snapshot.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/snapshots/restore-snapshot/ - snapshot.restore}
 *
 * @memberOf API-Snapshot
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {string} [params.master_timeout] DEPRECATED - Explicit operation timeout for connection to cluster-manager node
 * @param {boolean} [params.wait_for_completion=false] - -| Whether to return a response after the restore operation has completed. When `false`, the request returns a response when the restore operation initializes. When `true`, the request returns a response when the restore operation completes.
 * @param {string} params.repository - The name of the repository containing the snapshot
 * @param {string} params.snapshot - The name of the snapshot to restore.
 * @param {object} [params.body] - Determines which settings and indexes to restore when restoring a snapshot
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function restoreFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.repository == null) return handleMissingParam('repository', this, callback);
  if (params.snapshot == null) return handleMissingParam('snapshot', this, callback);

  let { body, repository, snapshot, ...querystring } = params;
  repository = parsePathParam(repository);
  snapshot = parsePathParam(snapshot);

  const path = '/_snapshot/' + repository + '/' + snapshot + '/_restore';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = restoreFunc;
