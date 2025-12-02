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
 * Creates or updates a data stream.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/data-streams/ - indices.create_data_stream}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} params.name - Name of the data stream, which must meet the following criteria: Lowercase only; Cannot include `\`, `/`, `*`, `?`, `"`, `<`, `>`, `|`, `,`, `#`, `:`, or a space character; Cannot start with `-`, `_`, `+`, or `.ds-`; Cannot be `.` or `..`; Cannot be longer than 255 bytes. Multi-byte characters count towards this limit faster.
 * @param {object} [params.body] - The data stream definition
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function createDataStreamFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_data_stream/' + name;
  const method = 'PUT';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = createDataStreamFunc;
