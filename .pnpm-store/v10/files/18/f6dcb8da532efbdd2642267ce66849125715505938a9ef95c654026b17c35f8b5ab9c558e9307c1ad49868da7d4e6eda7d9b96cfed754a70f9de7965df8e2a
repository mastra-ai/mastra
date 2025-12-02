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
 * Returns information about the names, components, and versions of the installed plugins.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-plugins/ - cat.plugins}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.cluster_manager_timeout] - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.local=false] - Returns local information but does not retrieve the state from the cluster manager node.
 * @param {string} [params.master_timeout] DEPRECATED - The amount of time allowed to establish a connection to the cluster manager node.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function pluginsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_cat/plugins';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = pluginsFunc;
