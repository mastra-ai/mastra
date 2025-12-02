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
 * Returns information about whether a particular index template exists.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.exists_template}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {boolean} [params.flat_settings=false] - Return settings in flat format.
 * @param {boolean} [params.local=false] - Return local information, do not retrieve the state from cluster-manager node.
 * @param {string} [params.master_timeout] DEPRECATED - Explicit operation timeout for connection to cluster-manager node
 * @param {string} params.name - The comma separated names of the index templates
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function existsTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_template/' + name;
  const method = 'HEAD';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = existsTemplateFunc;
