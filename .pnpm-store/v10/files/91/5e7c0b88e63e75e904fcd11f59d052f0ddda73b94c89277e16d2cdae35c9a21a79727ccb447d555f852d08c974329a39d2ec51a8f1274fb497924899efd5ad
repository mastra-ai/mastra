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
 * Terminates the replication and converts the follower index to a standard index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/tuning-your-cluster/replication-plugin/api/#stop-replication - replication.stop}
 *
 * @memberOf API-Replication
 *
 * @param {object} params
 * @param {string} params.index - The name of the data stream, index, or index alias to perform bulk actions on.
 * @param {object} params.body 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function stopFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = '/_plugins/_replication/' + index + '/_stop';
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = stopFunc;
