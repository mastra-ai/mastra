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
 * Retrieves the specified node's security certificates.
 * <br/> See Also: {@link undefined - security.get_node_certificates}
 *
 * @memberOf API-Security
 *
 * @param {object} params
 * @param {string} [params.cert_type] - The type of certificates (`HTTP`, `TRANSPORT`, or `ALL`) to retrieve from a node.
 * @param {string} [params.timeout] - The maximum duration, in seconds, to spend retrieving certificates from all nodes before a timeout.
 * @param {string} params.node_id - The node ID to retrieve certificates for.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getNodeCertificatesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.node_id == null) return handleMissingParam('node_id', this, callback);

  let { body, node_id, ...querystring } = params;
  node_id = parsePathParam(node_id);

  const path = '/_plugins/_security/api/certificates/' + node_id;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getNodeCertificatesFunc;
