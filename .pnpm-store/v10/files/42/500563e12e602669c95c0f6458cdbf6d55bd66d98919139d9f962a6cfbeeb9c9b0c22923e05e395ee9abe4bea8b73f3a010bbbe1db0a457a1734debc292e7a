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
 * Returns information about a task.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/tasks/ - tasks.get}
 *
 * @memberOf API-Tasks
 *
 * @param {object} params
 * @param {string} [params.timeout] - The amount of time to wait for a response.
 * @param {boolean} [params.wait_for_completion=false] - Waits for the matching task to complete. When `true`, the request is blocked until the task has completed.
 * @param {string} params.task_id - The task ID.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.task_id == null) return handleMissingParam('task_id', this, callback);

  let { body, task_id, ...querystring } = params;
  task_id = parsePathParam(task_id);

  const path = '/_tasks/' + task_id;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getFunc;
