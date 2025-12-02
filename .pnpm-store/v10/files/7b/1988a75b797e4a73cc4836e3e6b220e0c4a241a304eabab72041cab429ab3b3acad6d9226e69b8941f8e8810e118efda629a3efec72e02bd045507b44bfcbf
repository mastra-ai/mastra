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
 * <br/> See Also: {@link https://opensearch.org/docs/latest/im-plugin/index-templates/ - indices.put_template}
 *
 * @memberOf API-Indices
 *
 * @param {object} params
 * @param {string} [params.cluster_manager_timeout] - Operation timeout for connection to cluster-manager node.
 * @param {boolean} [params.create=false] - If `true`, this request cannot replace or update existing index templates.
 * @param {string} [params.master_timeout] DEPRECATED - Period to wait for a connection to the cluster-manager node. If no response is received before the timeout expires, the request fails and returns an error.
 * @param {number} [params.order] - Order in which OpenSearch applies this template if index matches multiple templates.  Templates with lower 'order' values are merged first. Templates with higher 'order' values are merged later, overriding templates with lower values.
 * @param {string} params.name - The name of the template
 * @param {object} params.body - The template definition
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function putTemplateFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.name == null) return handleMissingParam('name', this, callback);
  if (params.body == null) return handleMissingParam('body', this, callback);

  let { body, name, ...querystring } = params;
  name = parsePathParam(name);

  const path = '/_template/' + name;
  const method = 'POST';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = putTemplateFunc;
