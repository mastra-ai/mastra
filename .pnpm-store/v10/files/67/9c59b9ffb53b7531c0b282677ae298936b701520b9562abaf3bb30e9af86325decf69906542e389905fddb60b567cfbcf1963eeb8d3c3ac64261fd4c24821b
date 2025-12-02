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
 * Returns multiple termvectors in one request.
 * <br/> See Also: {@link https://opensearch.org/docs/latest - mtermvectors}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {boolean} [params.field_statistics=true] - If `true`, the response includes the document count, sum of document frequencies, and sum of total term frequencies.
 * @param {string} [params.fields] - Comma-separated list or wildcard expressions of fields to include in the statistics. Used as the default list unless a specific field list is provided in the `completion_fields` or `fielddata_fields` parameters.
 * @param {array} [params.ids] - A comma-separated list of documents ids. You must define ids as parameter or set "ids" or "docs" in the request body
 * @param {boolean} [params.offsets=true] - If `true`, the response includes term offsets.
 * @param {boolean} [params.payloads=true] - If `true`, the response includes term payloads.
 * @param {boolean} [params.positions=true] - If `true`, the response includes term positions.
 * @param {string} [params.preference=random] - Specifies the node or shard the operation should be performed on. Random by default.
 * @param {boolean} [params.realtime=true] - If `true`, the request is real-time as opposed to near-real-time.
 * @param {string} [params.routing] - Custom value used to route operations to a specific shard.
 * @param {boolean} [params.term_statistics=false] - If `true`, the response includes term frequency and document frequency.
 * @param {number} [params.version] - If `true`, returns the document version as part of a hit.
 * @param {string} [params.version_type] - Specific version type.
 * @param {string} [params.index] - Name of the index that contains the documents.
 * @param {object} [params.body] - Define ids, documents, parameters or a list of parameters per document here. You must at least provide a list of document ids. See documentation.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function mtermvectorsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, index, ...querystring } = params;
  index = parsePathParam(index);

  const path = ['', index, '_mtermvectors'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = mtermvectorsFunc;
