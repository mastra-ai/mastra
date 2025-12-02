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
 * Creates or updates an index template.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/index-templates/ - indices.put_index_template}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.cause=false] - User defined reason for creating/updating the index template.
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {boolean} [params.create=false] - If `true`, this request cannot replace or update existing index templates.
 * @param {string} [params.master_timeout] DEPRECATED - Operation timeout for connection to cluster-manager node.
 * @param {string} params.name - Index or template name
 * @param {object} params.body - The template definition
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putIndexTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_index_template/' + name;
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putIndexTemplateFunc;
