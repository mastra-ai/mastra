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
 * Retrieves the cluster security certificates.
 * <br/> See Also: {@link undefined - security.get_all_certificates}
 *
 * @memberOf API-Security
 *
 * @param {object} [params]
 * @param {string} [params.cert_type] - The type of certificates (`HTTP`, `TRANSPORT`, or `ALL`) to retrieve from all nodes.
 * @param {string} [params.timeout] - The maximum duration, in seconds, to spend retrieving certificates from all nodes before a timeout.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getAllCertificatesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_security/api/certificates';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getAllCertificatesFunc;
