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
 * Execute an agent.
 * <br/> See Also: {@link undefined - ml.execute_agent}
 *
 * @memberOf API-Ml
 *
 * @param {object} params
 * @param {string} params.agent_id 
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function executeAgentFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);
  if (params.agent_id == null) return handleMissingParam('agent_id', this, callback);

  let { body, agent_id, ...querystring } = params;
  agent_id = parsePathParam(agent_id);

  const path = '/_plugins/_ml/agents/' + agent_id + '/_execute';
  const method = 'POST';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = executeAgentFunc;
