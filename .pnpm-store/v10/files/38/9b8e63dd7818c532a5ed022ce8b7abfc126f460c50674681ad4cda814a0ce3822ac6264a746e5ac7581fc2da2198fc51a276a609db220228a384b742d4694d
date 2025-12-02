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
 * Lists the progress of all tasks currently running on the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-tasks/ - cat.tasks}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {array} [params.actions] - The task action names used to limit the response.
 * @param {boolean} [params.detailed=false] - If `true`, the response includes detailed information about shard recoveries.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {array} [params.nodes] - A comma-separated list of node IDs or names used to limit the returned information.  Use `_local` to return information from the node to which you're connecting, specify a specific node from which to get information, or keep the parameter empty to get information from all nodes.
 * @param {string} [params.parent_task_id] - The parent task identifier, which is used to limit the response.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {string} [params.time] - Specifies the time units, for example, `5d` or `7h`. For more information, see [Supported units](https://opensearch.org/docs/latest/api-reference/units/).
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function tasksFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cat/tasks';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = tasksFunc;
