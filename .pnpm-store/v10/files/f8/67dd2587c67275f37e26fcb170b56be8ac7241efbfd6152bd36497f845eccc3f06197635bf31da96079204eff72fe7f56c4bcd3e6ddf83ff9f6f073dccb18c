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
 * Shows how much heap memory is currently being used by field data on every data node in the cluster.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-field-data/ - cat.fielddata}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {string} [params.bytes] - The units used to display byte values.
 * @param {string} [params.fields] - A comma-separated list of fields used to limit the amount of returned information. To retrieve all fields, omit this parameter.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function fielddataFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, fields, ...querystring } = params;
  fields = parsePathParam(fields);

  const path = ['/_cat/fielddata', fields].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = fielddataFunc;
