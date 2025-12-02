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
 * Returns a list of tasks.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/tasks/ - tasks.list}
 *
 * @memberOf API-Tasks
 *
 * @param {object} [params]
 * @param {string} [params.actions] - A comma-separated list of actions that should be returned. Keep empty to return all.
 * @param {boolean} [params.detailed=false] - When `true`, the response includes detailed information about shard recoveries.
 * @param {string} [params.group_by] - Groups tasks by parent/child relationships or nodes.
 * @param {array} [params.nodes] - A comma-separated list of node IDs or names used to limit the returned information. Use `_local` to return information from the node you're connecting to, specify the node name to get information from a specific node, or keep the parameter empty to get information from all nodes.
 * @param {string} [params.parent_task_id] - Returns tasks with a specified parent task ID (`node_id:task_number`). Keep empty or set to -1 to return all.
 * @param {string} [params.timeout] - The amount of time to wait for a response.
 * @param {boolean} [params.wait_for_completion=false] - Waits for the matching task to complete. When `true`, the request is blocked until the task has completed.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function listFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_tasks';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = listFunc;
