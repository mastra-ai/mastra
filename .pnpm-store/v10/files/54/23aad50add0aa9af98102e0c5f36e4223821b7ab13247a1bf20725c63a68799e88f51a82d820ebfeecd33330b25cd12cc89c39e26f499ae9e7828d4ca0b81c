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
 * Start rollup.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/index-rollups/rollup-api/#start-or-stop-an-index-rollup-job - rollups.start}
 *
 * @memberOf API-Rollups
 *
 * @param {object} params
 * @param {string} params.id - Rollup to access
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function startFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);

  let { body, id, ...querystring } = params;
  id = parsePathParam(id);

  const path = '/_plugins/_rollup/jobs/' + id + '/_start';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = startFunc;
