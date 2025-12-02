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
 * Get a specific channel configuration.
 * <br/> See Also: {@link undefined - notifications.get_config}
 *
 * @memberOf API-Notifications
 *
 * @param {object} params
 * @param {string} params.config_id 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getConfigFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.config_id == null) return handleMissingParam('config_id', this, callback);

  let { body, config_id, ...querystring } = params;
  config_id = parsePathParam(config_id);

  const path = '/_plugins/_notifications/configs/' + config_id;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getConfigFunc;
