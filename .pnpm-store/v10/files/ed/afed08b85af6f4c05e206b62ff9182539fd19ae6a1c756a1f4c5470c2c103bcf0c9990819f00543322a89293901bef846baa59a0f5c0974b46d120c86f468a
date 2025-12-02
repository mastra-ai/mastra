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

const { normalizeArguments, parsePathParam } = require('../utils');

/**
 * Simulate resolving the given template name or body.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.simulate_template}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {string} [params.cause=false] - User defined reason for dry-run creating the new template for simulation purposes.
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {boolean} [params.create=false] - If `true`, the template passed in the body is only used if no existing templates match the same index patterns. If `false`, the simulation uses the template with the highest priority. Note that the template is not permanently added or updated in either case; it is only used for the simulation.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {string} [params.name] - Name of the index template to simulate. To test a template configuration before you add it to the cluster, omit this parameter and specify the template configuration in the request body.
 * @param {object} [params.body] - New index template definition to be simulated, if no index template name is specified.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function simulateTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = ['/_index_template/_simulate', name].filter(c => c != null).join('/');
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = simulateTemplateFunc;
