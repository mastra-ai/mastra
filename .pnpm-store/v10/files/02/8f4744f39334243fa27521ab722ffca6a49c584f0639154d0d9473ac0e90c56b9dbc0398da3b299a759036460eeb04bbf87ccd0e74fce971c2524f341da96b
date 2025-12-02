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
 * Returns information about active and last-completed segment replication events on each replica shard, including related shard-level metrics. 
These metrics provide information about how far behind the primary shard the replicas are lagging.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/cat/cat-segment-replication/ - cat.segment_replication}
 *
 * @memberOf API-Cat
 *
 * @param {object} [params]
 * @param {boolean} [params.active_only=false] - When `true`, the response only includes ongoing segment replication events.
 * @param {boolean} [params.allow_no_indices] - Whether to ignore the index if a wildcard index expression resolves to no concrete indexes. This includes the `_all` string or when no indexes have been specified.
 * @param {string} [params.bytes] - The units used to display byte values.
 * @param {boolean} [params.completed_only=false] - When `true`, the response only includes the last-completed segment replication events.
 * @param {boolean} [params.detailed=false] - When `true`, the response includes additional metrics for each stage of a segment replication event.
 * @param {string} [params.expand_wildcards] - Specifies the type of index that wildcard expressions can match. Supports comma-separated values.
 * @param {string} [params.format] - A short version of the `Accept` header, such as `json` or `yaml`.
 * @param {array} [params.h] - A comma-separated list of column names to display.
 * @param {boolean} [params.help=false] - Returns help information.
 * @param {boolean} [params.ignore_throttled] - Whether specified concrete, expanded, or aliased indexes should be ignored when throttled.
 * @param {boolean} [params.ignore_unavailable] - Whether the specified concrete indexes should be ignored when missing or closed.
 * @param {array} [params.index] - A comma-separated list of data streams, indexes, and aliases used to limit the request. Supports wildcards (`*`). To target all data streams and indexes, omit this parameter or use `*` or `_all`.
 * @param {array} [params.s] - A comma-separated list of column names or column aliases to sort by.
 * @param {array} [params.shards] - A comma-separated list of shards to display.
 * @param {string} [params.time] - Specifies the time units, for example, `5d` or `7h`. For more information, see [Supported units](https://opensearch.org/docs/latest/api-reference/units/).
 * @param {string} [params.timeout] - The operation timeout.
 * @param {boolean} [params.v=false] - Enables verbose mode, which displays column headers.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function segmentReplicationFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['/_cat/segment_replication', index].filter(c => c != null).join('/');
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = segmentReplicationFunc;
