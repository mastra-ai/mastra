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

const { normalizeArguments, handleMissingParam } = require('../utils');

/**
 * Delete multiple channel configurations.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/observing-your-data/notifications/api/#delete-channel-configuration - notifications.delete_configs}
 *
 * @memberOf API-Notifications
 *
 * @param {object} params
 * @param {string} params.config_id - The ID of the channel configuration to delete.
 * @param {string} [params.config_id_list] - A comma-separated list of channel IDs to delete.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function deleteConfigsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.config_id == null) return handleMissingParam('config_id', this, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_notifications/configs';
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = deleteConfigsFunc;
