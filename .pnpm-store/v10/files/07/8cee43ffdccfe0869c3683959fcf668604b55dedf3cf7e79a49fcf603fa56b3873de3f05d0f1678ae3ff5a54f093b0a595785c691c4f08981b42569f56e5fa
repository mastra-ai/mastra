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
 * Returns information about a snapshot.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - snapshot.get}
 *
 * @memberOf API-Snapshot
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - The amount of time to wait for a response from the cluster manager node. For more information about supported time units, see [Common parameters](https://opensearch.org/docs/latest/api-reference/common-parameters/#time-units).
 * @param {boolean} [params.ignore_unavailable=false] - When `false`, the request returns an error for any snapshots that are unavailable.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {boolean} [params.verbose] - When `true`, returns additional information about each snapshot such as the version of OpenSearch which took the snapshot, the start and end times of the snapshot, and the number of shards contained in the snapshot.
 * @param {string} params.repository - A comma-separated list of snapshot repository names used to limit the request. Wildcard (*) expressions are supported.
 * @param {string} params.snapshot - A comma-separated list of snapshot names to retrieve. Also accepts wildcard expressions. (`*`). - To get information about all snapshots in a registered repository, use a wildcard (`*`) or `_all`. - To get information about any snapshots that are currently running, use `_current`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.repository == null) return handleMissingParam('repository', this, callback);
  if (params.snapshot == null) return handleMissingParam('snapshot', this, callback);

  let { body, repository, snapshot, ...querystring } = params;
  repository = parsePathParam(repository);
  snapshot = parsePathParam(snapshot);

  const path = '/_snapshot/' + repository + '/' + snapshot;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getFunc;
