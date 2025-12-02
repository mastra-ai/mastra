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
 * Returns information about why a specific matches (or doesn't match) a query.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/explain/ - explain}
 *
 * @memberOf API-Core
 *
 * @param {object} params
 * @param {string} [params._source] - Set to `true` or `false` to return the `_source` field or not, or a list of fields to return.
 * @param {string} [params._source_excludes] - A comma-separated list of source fields to exclude from the response.
 * @param {string} [params._source_includes] - A comma-separated list of source fields to include in the response.
 * @param {boolean} [params.analyze_wildcard=false] - If `true`, wildcard and prefix queries are analyzed.
 * @param {string} [params.analyzer] - Analyzer to use for the query string. This parameter can only be used when the `q` query string parameter is specified.
 * @param {string} [params.default_operator] - The default operator for query string query: `AND` or `OR`.
 * @param {string} [params.df=_all] - Field to use as default where no field prefix is given in the query string.
 * @param {boolean} [params.lenient] - If `true`, format-based query failures (such as providing text to a numeric field) in the query string will be ignored.
 * @param {string} [params.preference=random] - Specifies the node or shard the operation should be performed on. Random by default.
 * @param {string} [params.q] - Query in the Lucene query string syntax.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {string} [params.stored_fields] - A comma-separated list of stored fields to return in the response.
 * @param {string} params.id - Defines the document ID.
 * @param {string} params.index - Index names used to limit the request. Only a single index name can be provided to this parameter.
 * @param {object} [params.body] - The query definition using the Query DSL
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function explainFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.id == null) return handleMissingParam('id', this, callback);
  if (params.index == null) return handleMissingParam('index', this, callback);

  let { body, id, index, ...querystring } = params;
  id = parsePathParam(id);
  index = parsePathParam(index);

  const path = '/' + index + '/_explain/' + id;
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = explainFunc;
