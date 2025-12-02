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
 * Creates or updates a script.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/script-apis/create-stored-script/ - put_script}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {string} [params.context] - Context in which the script or search template should run. To prevent errors, the API immediately compiles the script or template in this context.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.timeout] - Period to wait for a response. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} params.id - Identifier for the stored script or search template. Must be unique within the cluster.
 * @param {object} params.body - The document
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putScriptFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, id, context, ...querystring } = params;
  id = parsePathParam(id);
  context = parsePathParam(context);

  const path = ['/_scripts', id, context].filter(c => c != null).join('/');
  const method = context == null ? 'POST' : 'PUT';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putScriptFunc;
