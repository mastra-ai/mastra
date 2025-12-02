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

const { normalizeArguments, parsePathParam } = require('../utils');

/**
 * Lists all of the snapshots stored in a specific repository.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-snapshots/ - cat.snapshots}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.cluster_manager_timeout] - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.ignore_unavailable=false] - When `true`, the response does not include information from unavailable snapshots.
 * @param {string} [params.master_timeout] DEPRECATED - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {string} [params.repository] - A comma-separated list of snapshot repositories used to limit the request. Accepts wildcard expressions. `_all` returns all repositories. If any repository fails during the request, OpenSearch returns an error.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {string} [params.time] - Specifies the time units, for example, `5d` or `7h`. For more information, see [Supported units](https://opensearch.org/docs/latest/api-reference/units/).
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function snapshotsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, repository, ...querystring } = params;
  repository = parsePathParam(repository);

  const path = ['/_cat/snapshots', repository].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = snapshotsFunc;
