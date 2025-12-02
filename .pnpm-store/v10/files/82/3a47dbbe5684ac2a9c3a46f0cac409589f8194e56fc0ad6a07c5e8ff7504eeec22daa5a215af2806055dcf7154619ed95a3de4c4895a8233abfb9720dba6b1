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
 * Simulates an ingest pipeline with example documents.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/api-reference/ingest-apis/simulate-ingest/ - ingest.simulate}
 *
 * @memberOf API-Ingest
 *
 * @param {object} params
 * @param {boolean} [params.verbose=false] - When `true`, the response includes output data for each processor in the pipeline
 * @param {string} [params.id] - The pipeline to test. If you don't specify a `pipeline` in the request body, this parameter is required.
 * @param {object} params.body - The simulate definition
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function simulateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, id, ...querystring } = params;
  id = parsePathParam(id);

  const path = ['/_ingest/pipeline', id, '_simulate'].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = simulateFunc;
