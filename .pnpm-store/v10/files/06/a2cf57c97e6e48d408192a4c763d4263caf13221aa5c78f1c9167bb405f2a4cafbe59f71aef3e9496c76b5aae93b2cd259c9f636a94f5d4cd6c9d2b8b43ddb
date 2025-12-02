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

const { normalizeArguments } = require('../utils');

/**
 * Updates the cluster voting configuration by excluding certain node IDs or names.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - cluster.post_voting_config_exclusions}
 *
 * @memberOf API-Cluster
 *
 * @param {object} [params]
 * @param {string} [params.node_ids] - A comma-separated list of node IDs to exclude from the voting configuration. When using this setting, you cannot also specify `node_names`. Either `node_ids` or `node_names` are required to receive a valid response.
 * @param {string} [params.node_names] - A comma-separated list of node names to exclude from the voting configuration. When using this setting, you cannot also specify `node_ids`. Either `node_ids` or `node_names` are required to receive a valid response.
 * @param {string} [params.timeout] - When adding a voting configuration exclusion, the API waits for the specified nodes to be excluded from the voting configuration before returning a response. If the timeout expires before the appropriate condition is satisfied, the request fails and returns an error.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function postVotingConfigExclusionsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cluster/voting_config_exclusions';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = postVotingConfigExclusionsFunc;
