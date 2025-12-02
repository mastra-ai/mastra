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
 * Provides statistics on operations happening in a data stream.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/data-streams/ - indices.data_streams_stats}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {string} [params.name] - Comma-separated list of data streams used to limit the request. Wildcard expressions (`*`) are supported. To target all data streams in a cluster, omit this parameter or use `*`.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function dataStreamsStatsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = ['/_data_stream', name, '_stats'].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = dataStreamsStatsFunc;
