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
 * Deletes specific observability object specified by ID.
 * <br/> See Also: {@link undefined - observability.delete_object}
 *
 * @memberOf API-Observability
 *
 * @param {object} params
 * @param {string} params.object_id - The ID of the Observability Object.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function deleteObjectFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.object_id == null) return handleMissingParam('object_id', this, callback);

  let { body, object_id, ...querystring } = params;
  object_id = parsePathParam(object_id);

  const path = '/_plugins/_observability/object/' + object_id;
  const method = 'DELETE';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = deleteObjectFunc;
