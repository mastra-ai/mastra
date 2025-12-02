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
 * Flushes the Security plugin's user, authentication, and authorization cache.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/security/access-control/api/#flush-cache - security.flush_cache}
 *
 * @memberOf API-Security
 *
 * @param {object} [params] - (Unused)
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function flushCacheFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_security/api/cache';
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = flushCacheFunc;
