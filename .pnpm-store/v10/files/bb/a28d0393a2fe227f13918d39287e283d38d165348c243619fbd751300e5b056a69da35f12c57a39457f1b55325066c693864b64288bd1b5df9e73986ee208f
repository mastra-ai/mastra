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
 * Provides statistics on operations happening in an index.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - indices.stats}
 *
 * @memberOf API-Indices
 *
 * @param {object} [params]
 * @param {string} [params.completion_fields] - Comma-separated list or wildcard expressions of fields to include in field data and suggest statistics.
 * @param {string} [params.expand_wildcards] - Type of index that wildcard patterns can match. If the request can target data streams, this argument determines whether wildcard expressions match hidden data streams. Supports comma-separated values, such as `open,hidden`.
 * @param {string} [params.fielddata_fields] - Comma-separated list or wildcard expressions of fields to include in field data statistics.
 * @param {string} [params.fields] - Comma-separated list or wildcard expressions of fields to include in the statistics.
 * @param {boolean} [params.forbid_closed_indices=true] - If `true`, statistics are not collected from closed indexes.
 * @param {string} [params.groups] - Comma-separated list of search groups to include in the search statistics.
 * @param {boolean} [params.include_segment_file_sizes=false] - If `true`, the call reports the aggregated disk usage of each one of the Lucene index files (only applies if segment stats are requested).
 * @param {boolean} [params.include_unloaded_segments=false] - If `true`, the response includes information from segments that are not loaded into memory.
 * @param {string} [params.level] - Indicates whether statistics are aggregated at the cluster, index, or shard level.
 * @param {string} [params.metric] - Limit the information returned the specific metrics.
 * @param {string} [params.index] - A comma-separated list of index names; use `_all` or empty string to perform the operation on all indexes
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function statsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, metric, index, ...querystring } = params;
  metric = parsePathParam(metric);
  index = parsePathParam(index);

  const path = ['', index, '_stats', metric].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = statsFunc;
