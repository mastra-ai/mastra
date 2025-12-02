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
 * Updates the individual attributes of an action group.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/security/access-control/api/#patch-action-group - security.patch_action_group}
 *
 * @memberOf API-Security
 *
 * @param {object} params
 * @param {string} params.action_group - The name of the action group to update.
 * @param {array} params.body 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function patchActionGroupFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.action_group == null) return handleMissingParam('action_group', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, action_group, ...querystring } = params;
  action_group = parsePathParam(action_group);

  const path = '/_plugins/_security/api/actiongroups/' + action_group;
  const method = 'PATCH';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = patchActionGroupFunc;
