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
 * Returns information about any matching indexes, aliases, and data streams.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.resolve_index}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`. Valid values are: `all`, `open`, `closed`, `hidden`, `none`.
 * @param {string} params.name - Comma-separated name(s) or index pattern(s) of the indexes, aliases, and data streams to resolve. Resources on remote clusters can be specified using the `<cluster>`:`<name>` syntax.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function resolveIndexFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_resolve/index/' + name;
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = resolveIndexFunc;
