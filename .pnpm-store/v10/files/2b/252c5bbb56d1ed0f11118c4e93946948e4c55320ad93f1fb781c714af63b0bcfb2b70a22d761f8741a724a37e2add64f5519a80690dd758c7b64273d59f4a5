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
 * Retrieves all node distinguished names. Requires super admin or REST API permissions.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/security/access-control/api/#get-distinguished-names - security.get_distinguished_names}
 *
 * @memberOf API-Security
 *
 * @param {object} [params]
 * @param {boolean} [params.show_all] - Whether to include or exclude any static node's DN settings from the final result.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getDistinguishedNamesFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_security/api/nodesdn';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getDistinguishedNamesFunc;
