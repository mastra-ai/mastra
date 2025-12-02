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
 * Allows to use the Mustache language to pre-render a search definition.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/search-plugins/search-template/ - render_search_template}
 *
 * @memberOf API-Core
 *
 * @param {object} [params]
 * @param {string} [params.id] - ID of the search template to render. If no `source` is specified, this or the `id` request body parameter is required.
 * @param {object} [params.body] - The search definition template and its parameters.
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function renderSearchTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, id, ...querystring } = params;
  id = parsePathParam(id);

  const path = ['/_render/template', id].filter(c => c != null).join('/');
  const method = body ? 'POST' : 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = renderSearchTemplateFunc;
